// netlify/functions/football.js
//
// Fonction backend unique qui sert de proxy vers API-Football.
// Rôle :
//   1. Ne jamais exposer API_FOOTBALL_KEY au frontend.
//   2. Mettre en cache les réponses (via Netlify Blobs) pour éviter de
//      dépasser le quota d'appels API.
//   3. Renvoyer des messages d'erreur compréhensibles, jamais une
//      erreur technique brute — tout en journalisant la cause réelle
//      dans les logs Netlify (et dans un champ "debug" de la réponse,
//      à retirer une fois le projet stabilisé).
//
// Appel depuis le frontend :
//   /.netlify/functions/football?endpoint=teams&search=Barcelona
//   /.netlify/functions/football?endpoint=standings&team=529&season=2026
//   /.netlify/functions/football?endpoint=fixtures&team=529&last=10

const { getStore } = require('@netlify/blobs');

const BASE_URL = 'https://v3.football.api-sports.io';

// Durées de cache par famille d'endpoint (en millisecondes).
const CACHE_TTL = {
  teams: 30 * 24 * 60 * 60 * 1000, // 30 jours — infos équipe / ID API
  leagues: 30 * 24 * 60 * 60 * 1000, // 30 jours — championnats
  standings: 6 * 60 * 60 * 1000, // 6 heures — classement
  fixtures: 3 * 60 * 60 * 1000, // 3 heures — matchs récents (par défaut)
};
const DEFAULT_TTL = 6 * 60 * 60 * 1000;

// Statuts API-Football qui signifient "match en cours" (dupliqué côté
// frontend dans src/utils/liveStatus.js — garder les deux copies synchronisées).
const LIVE_STATUSES = ['1H', '2H', 'ET', 'P', 'BT', 'HT', 'SUSP', 'INT', 'LIVE'];
const LIVE_TTL = 60 * 1000; // 1 minute pendant un match en direct
const UPCOMING_TTL = 2 * 60 * 60 * 1000; // 2 heures pour les prochains matchs

function containsLiveFixture(data) {
  const list = Array.isArray(data?.response) ? data.response : [];
  return list.some((f) => LIVE_STATUSES.includes(f?.fixture?.status?.short));
}

function getTTL(endpoint, params, data) {
  if (endpoint.startsWith('fixtures')) {
    if (containsLiveFixture(data)) return LIVE_TTL;
    if (params.next) return UPCOMING_TTL;
    return CACHE_TTL.fixtures;
  }
  const key = Object.keys(CACHE_TTL).find((k) => endpoint.startsWith(k));
  return key ? CACHE_TTL[key] : DEFAULT_TTL;
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

// Le cache (Netlify Blobs) est un confort, pas une dépendance critique :
// s'il n'est pas disponible (compte/plan, contexte d'exécution, etc.),
// la fonction doit continuer à répondre normalement en tapant à chaque
// fois l'API, plutôt que de planter toute la requête. getStore() peut
// lever une exception SYNCHRONE si l'environnement Blobs n'est pas
// configuré — c'était la cause la plus probable du "Erreur inattendue
// côté serveur" : getStore() n'était pas protégé par un try/catch.
function getSafeStore() {
  try {
    return getStore('football-cache');
  } catch (err) {
    console.error('[football.js] Netlify Blobs indisponible, cache désactivé pour cette requête:', err?.message, err?.stack);
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return respond(200, {});

  try {
    const query = { ...(event.queryStringParameters || {}) };
    const { endpoint } = query;
    delete query.endpoint;

    if (!endpoint) {
      return respond(400, { error: 'Paramètre "endpoint" manquant.', code: 'MISSING_ENDPOINT' });
    }

    const apiKey = process.env.API_FOOTBALL_KEY;
    if (!apiKey) {
      return respond(200, {
        error: "La clé API n'est pas configurée côté serveur.",
        code: 'NO_API_KEY',
      });
    }

    const store = getSafeStore();
    const forceRefresh = query._refresh === 'true';
    delete query._refresh;

    const cacheKey = `${endpoint}:${JSON.stringify(query, Object.keys(query).sort())}`;

    let cached = null;
    if (store) {
      try {
        cached = await store.get(cacheKey, { type: 'json' });
      } catch (err) {
        console.error('[football.js] Lecture du cache échouée:', err?.message);
        cached = null;
      }
    }

    const effectiveTTL = cached?.ttlUsed ?? getTTL(endpoint, query, cached?.data);
    const isFresh = cached && Date.now() - cached.timestamp < effectiveTTL;

    if (isFresh && !forceRefresh) {
      return respond(200, {
        ...cached.data,
        _meta: { cached: true, cachedAt: cached.timestamp, stale: false, isLive: !!cached.isLive },
      });
    }

    const qs = new URLSearchParams(query).toString();
    const url = `${BASE_URL}/${endpoint}${qs ? `?${qs}` : ''}`;

    let apiResponse;
    try {
      apiResponse = await fetch(url, {
        headers: { 'x-apisports-key': apiKey },
      });
    } catch (err) {
      console.error('[football.js] fetch vers API-Football a échoué:', err?.message, err?.stack);
      if (cached) {
        return respond(200, {
          ...cached.data,
          _meta: { cached: true, cachedAt: cached.timestamp, stale: true },
          _warning: 'Connexion à l\'API impossible. Dernières données disponibles affichées.',
        });
      }
      return respond(200, { error: 'Connexion à l\'API impossible.', code: 'NETWORK_ERROR', debug: err?.message });
    }

    if (apiResponse.status === 429) {
      if (cached) {
        return respond(200, {
          ...cached.data,
          _meta: { cached: true, cachedAt: cached.timestamp, stale: true },
          _warning: 'Le quota API a été atteint. Les dernières données disponibles sont affichées.',
        });
      }
      return respond(200, { error: 'Le quota API a été atteint.', code: 'QUOTA_EXCEEDED' });
    }

    if (apiResponse.status === 401 || apiResponse.status === 403) {
      const bodyText = await apiResponse.text().catch(() => '');
      console.error('[football.js] API-Football a refusé la clé:', apiResponse.status, bodyText);
      return respond(200, {
        error: "La clé API-Football a été refusée (vérifie API_FOOTBALL_KEY dans Netlify).",
        code: 'INVALID_API_KEY',
        debug: bodyText.slice(0, 300),
      });
    }

    if (!apiResponse.ok) {
      const bodyText = await apiResponse.text().catch(() => '');
      console.error('[football.js] Réponse HTTP non-OK d\'API-Football:', apiResponse.status, bodyText);
      if (cached) {
        return respond(200, {
          ...cached.data,
          _meta: { cached: true, cachedAt: cached.timestamp, stale: true },
          _warning: 'L\'API est indisponible actuellement. Dernières données disponibles affichées.',
        });
      }
      return respond(200, { error: 'L\'API est indisponible actuellement.', code: 'API_UNAVAILABLE', debug: bodyText.slice(0, 300) });
    }

    let data;
    try {
      data = await apiResponse.json();
    } catch (err) {
      console.error('[football.js] Parsing JSON de la réponse API-Football a échoué:', err?.message);
      return respond(200, { error: 'Réponse de l\'API illisible.', code: 'PARSE_ERROR', debug: err?.message });
    }

    const errorList = Array.isArray(data.errors) ? data.errors : Object.values(data.errors || {});
    if (errorList.length > 0) {
      console.error('[football.js] API-Football a renvoyé des erreurs:', JSON.stringify(data.errors));
      return respond(200, {
        error: 'Erreur renvoyée par API-Football.',
        details: data.errors,
        code: 'API_ERROR',
      });
    }

    const isLive = endpoint.startsWith('fixtures') && containsLiveFixture(data);
    const ttlUsed = getTTL(endpoint, query, data);

    if (store) {
      try {
        await store.setJSON(cacheKey, { data, timestamp: Date.now(), ttlUsed, isLive });
      } catch (err) {
        console.error('[football.js] Écriture du cache échouée:', err?.message);
      }
    }

    return respond(200, { ...data, _meta: { cached: false, cachedAt: Date.now(), stale: false, isLive } });
  } catch (err) {
    console.error('[football.js] Erreur inattendue:', err?.message, err?.stack);
    return respond(200, { error: 'Erreur inattendue côté serveur.', code: 'SERVER_ERROR', debug: err?.message });
  }
};

// netlify/functions/football.js
//
// Fonction backend unique qui sert de proxy vers API-Football.
// Rôle :
//   1. Ne jamais exposer API_FOOTBALL_KEY au frontend.
//   2. Mettre en cache les réponses (via Netlify Blobs) pour éviter de
//      dépasser le quota d'appels API.
//   3. Renvoyer des messages d'erreur compréhensibles, jamais une
//      erreur technique brute.
//
// Appel depuis le frontend :
//   /.netlify/functions/football?endpoint=teams&search=Barcelona
//   /.netlify/functions/football?endpoint=standings&team=529&season=2024
//   /.netlify/functions/football?endpoint=fixtures&team=529&last=10

const { getStore } = require('@netlify/blobs');

const BASE_URL = 'https://v3.football.api-sports.io';

// Durées de cache par famille d'endpoint (en millisecondes).
// Les données qui changent peu (recherche d'équipe) sont conservées
// longtemps ; les données qui évoluent (classement, matchs) sont
// rafraîchies plus souvent.
const CACHE_TTL = {
  teams: 30 * 24 * 60 * 60 * 1000, // 30 jours — infos équipe / ID API
  leagues: 30 * 24 * 60 * 60 * 1000, // 30 jours — championnats
  standings: 6 * 60 * 60 * 1000, // 6 heures — classement
  fixtures: 3 * 60 * 60 * 1000, // 3 heures — matchs récents (par défaut)
};
const DEFAULT_TTL = 6 * 60 * 60 * 1000;

// Statuts API-Football qui signifient "match en cours" (source de vérité
// aussi dupliquée côté frontend dans src/utils/liveStatus.js — les deux
// copies doivent rester synchronisées car frontend et backend tournent
// dans deux environnements séparés).
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

    const store = getStore('football-cache');
    const forceRefresh = query._refresh === 'true';
    delete query._refresh;

    const cacheKey = `${endpoint}:${JSON.stringify(query, Object.keys(query).sort())}`;

    let cached = null;
    try {
      cached = await store.get(cacheKey, { type: 'json' });
    } catch {
      cached = null;
    }

    // Le TTL peut dépendre du contenu (ex : un match en direct dans la
    // réponse) donc on relit le TTL qui avait été calculé et stocké au
    // moment de l'écriture, plutôt que de le recalculer à l'aveugle.
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
    } catch {
      if (cached) {
        return respond(200, {
          ...cached.data,
          _meta: { cached: true, cachedAt: cached.timestamp, stale: true },
          _warning: 'Connexion à l\'API impossible. Dernières données disponibles affichées.',
        });
      }
      return respond(200, { error: 'Connexion à l\'API impossible.', code: 'NETWORK_ERROR' });
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

    if (!apiResponse.ok) {
      if (cached) {
        return respond(200, {
          ...cached.data,
          _meta: { cached: true, cachedAt: cached.timestamp, stale: true },
          _warning: 'L\'API est indisponible actuellement. Dernières données disponibles affichées.',
        });
      }
      return respond(200, { error: 'L\'API est indisponible actuellement.', code: 'API_UNAVAILABLE' });
    }

    const data = await apiResponse.json();

    if (data.errors && Array.isArray(data.errors) ? data.errors.length > 0 : Object.keys(data.errors || {}).length > 0) {
      return respond(200, {
        error: 'Erreur renvoyée par API-Football.',
        details: data.errors,
        code: 'API_ERROR',
      });
    }

    if (!data.response || (Array.isArray(data.response) && data.response.length === 0)) {
      // Réponse vide légitime (ex : équipe sans match) — on la met quand
      // même en cache pour éviter de re-frapper l'API inutilement.
    }

    const isLive = endpoint.startsWith('fixtures') && containsLiveFixture(data);
    const ttlUsed = getTTL(endpoint, query, data);

    try {
      await store.setJSON(cacheKey, { data, timestamp: Date.now(), ttlUsed, isLive });
    } catch {
      // Le cache est une optimisation, pas une dépendance critique :
      // si l'écriture échoue on continue quand même.
    }

    return respond(200, { ...data, _meta: { cached: false, cachedAt: Date.now(), stale: false, isLive } });
  } catch (err) {
    return respond(200, { error: 'Erreur inattendue côté serveur.', code: 'SERVER_ERROR' });
  }
};

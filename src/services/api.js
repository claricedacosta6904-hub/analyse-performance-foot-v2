// src/services/api.js
//
// Toutes les requêtes vers API-Football passent par la fonction Netlify
// /.netlify/functions/football, qui gère la clé API et le cache serveur.
// Ce fichier ne contient jamais de clé API.

const FUNCTION_URL = '/.netlify/functions/football';

class ApiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

async function callFunction(endpoint, params = {}) {
  const qs = new URLSearchParams({ endpoint, ...params }).toString();
  const res = await fetch(`${FUNCTION_URL}?${qs}`);

  let json;
  try {
    json = await res.json();
  } catch {
    throw new ApiError('Impossible de récupérer les données actuellement.', 'PARSE_ERROR');
  }

  if (json.error) {
    // TEMPORAIRE (débogage) : le backend peut joindre un champ "debug"
    // avec la cause technique réelle (voir netlify/functions/football.js).
    // On l'ajoute entre parenthèses pour la voir directement dans
    // l'interface, sans avoir à ouvrir les logs Netlify. À retirer une
    // fois le projet stabilisé.
    const message = json.debug ? `${json.error} (${json.debug})` : json.error;
    throw new ApiError(message, json.code || 'UNKNOWN');
  }

  return json;
}

// Recherche une équipe par nom approximatif.
export async function searchTeams(name) {
  const json = await callFunction('teams', { search: name });
  return json.response || [];
}

// Récupère le classement d'une équipe (et le championnat associé) pour
// une saison donnée. team + season -> l'API renvoie les ligues où
// l'équipe évolue, avec le tableau de classement complet de chacune.
export async function getStandingsForTeam(teamId, season) {
  const json = await callFunction('standings', { team: teamId, season });
  return json.response || [];
}

// Récupère les derniers matchs d'une équipe.
export async function getFixturesForTeam(teamId, season, last = 10) {
  const json = await callFunction('fixtures', { team: teamId, season, last });
  return { fixtures: json.response || [], meta: json._meta || {} };
}

// Récupère les prochains matchs d'une équipe (utile pour détecter un
// match en direct ou à venir dans les heures qui suivent).
export async function getNextFixturesForTeam(teamId, season, next = 3) {
  const json = await callFunction('fixtures', { team: teamId, season, next });
  return { fixtures: json.response || [], meta: json._meta || {} };
}

export { ApiError };

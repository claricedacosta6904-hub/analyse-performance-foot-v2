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

// Championnats d'une équipe pour une saison (avec la couverture de données).
export async function getLeaguesForTeam(teamId, season) {
  const json = await callFunction('leagues', { team: teamId, season });
  return json.response || [];
}

// Classement complet d'un championnat précis (league + season).
export async function getStandingsForLeague(leagueId, season) {
  const json = await callFunction('standings', { league: leagueId, season });
  return json.response || [];
}

// Ancienne méthode (secours) : classements de toutes les compétitions d'une équipe.
export async function getStandingsForTeam(teamId, season) {
  const json = await callFunction('standings', { team: teamId, season });
  return json.response || [];
}

// Tous les matchs de la saison pour une équipe (passés, en cours, à venir).
// On n'utilise PAS les paramètres last / next : ils ne sont pas disponibles
// sur certains plans API-Football et faisaient échouer toute la requête.
export async function getSeasonFixtures(teamId, season) {
  const json = await callFunction('fixtures', { team: teamId, season });
  return { fixtures: json.response || [], meta: json._meta || {} };
}

// Statistiques de saison (contient la forme récente, ex "WDLWW") — secours.
export async function getTeamStatistics(teamId, leagueId, season) {
  const json = await callFunction('teams/statistics', { team: teamId, league: leagueId, season });
  return json.response || null;
}

export { ApiError };

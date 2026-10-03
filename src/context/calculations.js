// src/utils/calculations.js
//
// Tous les calculs statistiques de l'application, à partir des matchs
// (fixtures) renvoyés par API-Football pour une équipe donnée.

// Détermine le résultat (W/D/L) d'un match du point de vue de teamId.
export function getResult(fixture, teamId) {
  const { teams, goals } = fixture;
  if (goals.home === null || goals.away === null) return null;
  const isHome = teams.home.id === teamId;
  const gf = isHome ? goals.home : goals.away;
  const ga = isHome ? goals.away : goals.home;
  if (gf > ga) return 'W';
  if (gf === ga) return 'D';
  return 'L';
}

// Points : victoire = 3, nul = 1, défaite = 0.
export function pointsForResult(result) {
  if (result === 'W') return 3;
  if (result === 'D') return 1;
  return 0;
}

// Calcule les statistiques de forme sur un ensemble de matchs (jouées uniquement).
// Forme % = points obtenus / points maximum possible (3 x nb matchs) x 100
export function computeFormStats(fixtures, teamId) {
  const played = fixtures
    .map((f) => ({ fixture: f, result: getResult(f, teamId) }))
    .filter((f) => f.result !== null);

  const wins = played.filter((f) => f.result === 'W').length;
  const draws = played.filter((f) => f.result === 'D').length;
  const losses = played.filter((f) => f.result === 'L').length;
  const points = played.reduce((sum, f) => sum + pointsForResult(f.result), 0);
  const maxPoints = played.length * 3;
  const formPercent = maxPoints > 0 ? (points / maxPoints) * 100 : 0;

  const goalsFor = played.reduce((sum, f) => {
    const isHome = f.fixture.teams.home.id === teamId;
    return sum + (isHome ? f.fixture.goals.home : f.fixture.goals.away);
  }, 0);
  const goalsAgainst = played.reduce((sum, f) => {
    const isHome = f.fixture.teams.home.id === teamId;
    return sum + (isHome ? f.fixture.goals.away : f.fixture.goals.home);
  }, 0);

  return {
    played: played.length,
    wins,
    draws,
    losses,
    points,
    maxPoints,
    formPercent: Number(formPercent.toFixed(2)),
    goalsFor,
    goalsAgainst,
    goalDiff: goalsFor - goalsAgainst,
    avgGoalsFor: played.length ? Number((goalsFor / played.length).toFixed(2)) : 0,
    avgGoalsAgainst: played.length ? Number((goalsAgainst / played.length).toFixed(2)) : 0,
    winRate: played.length ? Number(((wins / played.length) * 100).toFixed(1)) : 0,
    drawRate: played.length ? Number(((draws / played.length) * 100).toFixed(1)) : 0,
    lossRate: played.length ? Number(((losses / played.length) * 100).toFixed(1)) : 0,
    sequence: played.map((f) => f.result), // ex: ['W','W','D','W','L'], plus récent en premier
  };
}

// Filtre les matchs joués à domicile / à l'extérieur par teamId,
// puis applique le même calcul de forme.
export function computeHomeStats(fixtures, teamId, limit = 5) {
  const homeFixtures = fixtures
    .filter((f) => f.teams.home.id === teamId && f.goals.home !== null)
    .slice(0, limit);
  return computeFormStats(homeFixtures, teamId);
}

export function computeAwayStats(fixtures, teamId, limit = 5) {
  const awayFixtures = fixtures
    .filter((f) => f.teams.away.id === teamId && f.goals.home !== null)
    .slice(0, limit);
  return computeFormStats(awayFixtures, teamId);
}

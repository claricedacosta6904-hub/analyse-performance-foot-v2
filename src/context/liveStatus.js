// src/utils/liveStatus.js
//
// IMPORTANT : LIVE_STATUSES est dupliqué dans netlify/functions/football.js
// (backend Node) car le frontend et les fonctions Netlify sont deux
// environnements de build séparés qui ne partagent pas de code source.
// Si tu modifies cette liste, modifie aussi l'autre.
export const LIVE_STATUSES = ['1H', '2H', 'ET', 'P', 'BT', 'HT', 'SUSP', 'INT', 'LIVE'];
export const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];

export function isFixtureLive(fixture) {
  return LIVE_STATUSES.includes(fixture?.fixture?.status?.short);
}

export function isFixtureFinished(fixture) {
  return FINISHED_STATUSES.includes(fixture?.fixture?.status?.short);
}

export function hasLiveFixture(fixtures = []) {
  return fixtures.some(isFixtureLive);
}

// Détermine l'état d'actualisation d'une équipe pour l'indicateur
// 🟢 à jour / 🟡 mise à jour nécessaire / 🔴 API indisponible
export function getDataStatus(entry, { liveThresholdMs = 2 * 60 * 1000, normalThresholdMs = 4 * 60 * 60 * 1000 } = {}) {
  if (!entry) return 'unknown';
  if (entry.error) return 'unavailable';
  if (!entry.timestamp) return 'unknown';
  const age = Date.now() - entry.timestamp;
  const threshold = entry.isLive ? liveThresholdMs : normalThresholdMs;
  return age < threshold ? 'up_to_date' : 'needs_refresh';
}

export const STATUS_LABELS = {
  up_to_date: { icon: '🟢', label: 'À jour' },
  needs_refresh: { icon: '🟡', label: 'Mise à jour nécessaire' },
  unavailable: { icon: '🔴', label: 'API indisponible' },
  unknown: { icon: '⚪', label: 'Non disponible' },
};

export function formatUpdateTime(iso) {
  if (!iso) return 'Jamais';
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

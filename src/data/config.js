// Saison utilisée pour toutes les requêtes (classement, matchs, stats).
//
// IMPORTANT : la saison n'est plus codée en dur. API-Football attend
// l'année de DÉBUT de la saison (ex: 2024 pour la saison 2024-2025).
// La plupart des championnats suivis (Europe) démarrent autour de
// juillet/août et se terminent autour de mai/juin l'année suivante.
// On considère donc que la "saison en cours" est :
//   - l'année civile en cours, si on est en juillet ou après ;
//   - l'année civile précédente, si on est avant juillet.
// Exemple : en octobre 2026 -> saison 2026. En mars 2026 -> saison 2025
// (car la saison 2025-2026 est toujours en cours).
export function getCurrentSeason(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = janvier ... 11 = décembre
  return month >= 6 ? year : year - 1; // juillet = index 6
}

// Génère la liste des saisons disponibles dans le sélecteur : la saison
// en cours + quelques saisons précédentes. Se met à jour automatiquement
// chaque année, sans modification de code.
export function getAvailableSeasons(date = new Date(), pastSeasonsCount = 4) {
  const current = getCurrentSeason(date);
  return Array.from({ length: pastSeasonsCount + 1 }, (_, i) => current - i);
}

// Nombre de matchs récents récupérés par défaut pour les pages
// MATCHS / FORME / DOMICILE / EXTÉRIEUR.
export const DEFAULT_LAST_MATCHES = 10;

export const NAV_ITEMS = [
  { key: 'accueil', label: 'Accueil', path: '/' },
  { key: 'equipes', label: 'Équipes', path: '/equipes' },
  { key: 'matchs', label: 'Matchs', path: '/matchs' },
  { key: 'classement', label: 'Classement', path: '/classement' },
  { key: 'forme', label: 'Forme', path: '/forme' },
  { key: 'domicile', label: 'Domicile', path: '/domicile' },
  { key: 'exterieur', label: 'Extérieur', path: '/exterieur' },
  { key: 'analyse', label: 'Analyse', path: '/analyse' },
  { key: 'parametres', label: 'Paramètres', path: '/parametres' },
];

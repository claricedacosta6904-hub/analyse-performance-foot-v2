// Saison utilisée pour toutes les requêtes (classement, matchs, stats).
// Modifie cette valeur pour changer de saison sans toucher au reste du code.
// API-Football attend l'année de début de saison (ex: 2024 pour 2024-2025).
export const CURRENT_SEASON = 2024;

export const AVAILABLE_SEASONS = [2024, 2023, 2022];

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

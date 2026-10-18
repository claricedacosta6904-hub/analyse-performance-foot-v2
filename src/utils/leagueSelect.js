// src/utils/leagueSelect.js
//
// Détermine le CHAMPIONNAT NATIONAL d'une équipe pour une saison donnée.
//
// Pourquoi : l'endpoint /standings?team=&season= renvoie TOUTES les
// compétitions de l'équipe (Ligue des champions, coupes...). Prendre le
// premier élément donnait souvent la mauvaise compétition, donc une
// position vide ("Non disponible"). On utilise plutôt /leagues?team=&season=
// puis on choisit le championnat (type "League") du pays de l'équipe.
//
// Entrée : réponse brute de /leagues?team=ID&season=YYYY
//   [{ league:{id,name,type,logo}, country:{name,code}, seasons:[{year,current,coverage}] }]

import { normalize } from './matching';

function seasonInfo(item, season) {
  return (item.seasons || []).find((s) => Number(s.year) === Number(season)) || null;
}

export function pickDomesticLeague(leaguesResponse, teamCountry, season) {
  const items = Array.isArray(leaguesResponse) ? leaguesResponse : [];
  if (items.length === 0) {
    return { league: null, reason: 'Aucun championnat renvoyé par API-Football pour cette équipe et cette saison.' };
  }

  const leaguesOnly = items.filter((i) => i.league?.type === 'League' && normalize(i.country?.name) !== 'world');
  if (leaguesOnly.length === 0) {
    return { league: null, reason: "Aucun championnat national (hors coupes) trouvé pour cette équipe." };
  }

  const sameCountry = leaguesOnly.filter((i) => normalize(i.country?.name) === normalize(teamCountry));
  const pool = sameCountry.length > 0 ? sameCountry : leaguesOnly;

  // Priorité : saison présente > classement couvert > saison "en cours" > id le plus bas
  const ranked = pool
    .map((item) => {
      const info = seasonInfo(item, season);
      return {
        item,
        info,
        score: (info ? 100 : 0) + (info?.coverage?.standings ? 10 : 0) + (info?.current ? 1 : 0),
      };
    })
    .sort((a, b) => b.score - a.score || a.item.league.id - b.item.league.id);

  const top = ranked[0];
  return {
    league: {
      id: top.item.league.id,
      name: top.item.league.name,
      logo: top.item.league.logo,
      country: top.item.country?.name || teamCountry || null,
    },
    seasonFound: !!top.info,
    coverage: top.info?.coverage || null,
    reason: top.info ? null : `Le championnat ${top.item.league.name} n'a pas de données pour la saison ${season}.`,
  };
}

// Aplatit la réponse de /standings?league=&season= en un tableau de lignes
// (certains championnats ont plusieurs groupes) et trouve la ligne de l'équipe.
export function extractStandings(standingsResponse, teamId) {
  const groups = standingsResponse?.[0]?.league?.standings || [];
  const rows = groups.flat();
  const standing = rows.find((r) => r.team?.id === Number(teamId)) || null;
  // Tableau du groupe qui contient l'équipe (sinon le premier groupe)
  const table = groups.find((g) => g.some((r) => r.team?.id === Number(teamId))) || groups[0] || [];
  return { standing, table };
}

// Version allégée d'une ligne de classement (pour le stockage local).
export function slimRow(row) {
  return {
    rank: row.rank,
    points: row.points,
    goalsDiff: row.goalsDiff,
    form: row.form || null,
    team: { id: row.team.id, name: row.team.name, logo: row.team.logo },
    all: {
      played: row.all?.played,
      win: row.all?.win,
      draw: row.all?.draw,
      lose: row.all?.lose,
      goals: { for: row.all?.goals?.for, against: row.all?.goals?.against },
    },
  };
}

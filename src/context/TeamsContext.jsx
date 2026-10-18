import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { searchTeams, getLeaguesForTeam, getStandingsForLeague, getStandingsForTeam, getSeasonFixtures, getTeamStatistics, ApiError } from '../services/api';
import { matchTeam, searchTerms, cleanTeamName, isSuspiciousTeam, FORCED_ID_FIXES } from '../utils/matching';
import { pickDomesticLeague, extractStandings, slimRow } from '../utils/leagueSelect';
import { isFixtureLive, isFixtureFinished } from '../utils/liveStatus';
import { getCurrentSeason, getAvailableSeasons, DEFAULT_LAST_MATCHES } from '../data/config';

const TeamsContext = createContext(null);

const ROSTER_KEY = 'apf_roster_v1';
const TEAM_DATA_PREFIX = 'apf_team_data_'; // + teamId + ':' + season
const LAST_UPDATED_KEY = 'apf_last_updated';
const SEASON_KEY = 'apf_season';

// Durée pendant laquelle on considère les données d'une équipe (déjà en
// mémoire côté client) comme fraîches, avant de les redemander au backend
// (qui a lui-même son propre cache serveur — voir netlify/functions/football.js).
// Si l'équipe a un match en direct, on utilise un délai beaucoup plus court.
const CLIENT_DATA_TTL = 4 * 60 * 60 * 1000; // 4h
const LIVE_CLIENT_TTL = 60 * 1000; // 1 minute
const LIVE_POLL_INTERVAL = 60 * 1000; // vérifie les équipes en direct toutes les minutes

function loadRoster() {
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRoster(roster) {
  try {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
  } catch {
    // stockage plein ou indisponible : on continue sans persister
  }
}

function loadSeason() {
  try {
    const raw = localStorage.getItem(SEASON_KEY);
    const parsed = raw ? Number(raw) : null;
    return parsed && !Number.isNaN(parsed) ? parsed : getCurrentSeason();
  } catch {
    return getCurrentSeason();
  }
}

function teamDataKey(teamId, season) {
  return `${TEAM_DATA_PREFIX}${teamId}:${season}`;
}

function loadTeamData(teamId, season) {
  try {
    const raw = localStorage.getItem(teamDataKey(teamId, season));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveTeamData(teamId, season, data) {
  try {
    localStorage.setItem(teamDataKey(teamId, season), JSON.stringify(data));
  } catch {
    // ignore
  }
}

const TABLE_PREFIX = 'apf_table_'; // + leagueId + ':' + season

function loadTable(leagueId, season) {
  try {
    const raw = localStorage.getItem(`${TABLE_PREFIX}${leagueId}:${season}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveTable(leagueId, season, table) {
  try {
    localStorage.setItem(`${TABLE_PREFIX}${leagueId}:${season}`, JSON.stringify(table));
  } catch {
    // ignore
  }
}

// Message lisible pour une erreur (ApiError ou autre).
function errMsg(err) {
  return err instanceof ApiError ? err.message : 'Impossible de récupérer les données actuellement.';
}

export function TeamsProvider({ children }) {
  const [roster, setRoster] = useState(loadRoster);
  const [season, setSeasonState] = useState(loadSeason);
  const [leagueTables, setLeagueTables] = useState({}); // { [leagueId]: lignes de classement } — saison sélectionnée
  const [teamData, setTeamData] = useState({}); // { [teamId]: { standing, fixtures, nextFixtures, isLive, timestamp } } — pour la saison sélectionnée
  const [lastUpdated, setLastUpdated] = useState(() => localStorage.getItem(LAST_UPDATED_KEY) || null);
  const [globalError, setGlobalError] = useState(null);
  const rosterRef = useRef(roster);
  rosterRef.current = roster;
  const teamDataRef = useRef(teamData);
  teamDataRef.current = teamData;
  const seasonRef = useRef(season);
  seasonRef.current = season;

  const availableSeasons = useMemo(() => getAvailableSeasons(), []);

  useEffect(() => saveRoster(roster), [roster]);

  const touchLastUpdated = useCallback(() => {
    const now = new Date().toISOString();
    setLastUpdated(now);
    localStorage.setItem(LAST_UPDATED_KEY, now);
  }, []);

  // Recherche + matching pour une liste de noms bruts saisis par l'utilisatrice.
  // Ne modifie pas le roster : renvoie des propositions à confirmer.
  const resolveTeamNames = useCallback(async (names) => {
    const results = [];
    for (const rawName of names) {
      const name = rawName.trim();
      if (!name) continue;
      try {
        const candidates = await searchTeams(name);
        if (!candidates.length) {
          results.push({ inputName: name, status: 'not_found', best: null, alternatives: [] });
          continue;
        }
        const match = matchTeam(name, candidates);
        results.push({ inputName: name, ...match });
      } catch (err) {
        results.push({
          inputName: name,
          status: 'error',
          error: err instanceof ApiError ? err.message : 'Erreur inconnue.',
        });
      }
    }
    return results;
  }, []);

  // Ajoute une équipe confirmée (candidate = objet API { team, venue }) au roster.
  const confirmTeam = useCallback((candidate) => {
    setRoster((prev) => {
      if (prev.some((t) => t.id === candidate.team.id)) return prev; // déjà présente
      return [
        ...prev,
        {
          id: candidate.team.id,
          name: candidate.team.name,
          country: candidate.team.country,
          logo: candidate.team.logo,
          leagueId: null,
          leagueName: null,
          leagueLogo: null,
          leagueCountry: null,
        },
      ];
    });
  }, []);

  const removeTeam = useCallback((teamId) => {
    setRoster((prev) => prev.filter((t) => t.id !== teamId));
    setTeamData((prev) => {
      const next = { ...prev };
      delete next[teamId];
      return next;
    });
    localStorage.removeItem(teamDataKey(teamId, seasonRef.current));
  }, []);

  // Récupère (ou rafraîchit) les données d'une équipe pour la saison
  // sélectionnée, dans cet ordre :
  //   1. /leagues?team=&season=   -> championnat NATIONAL (league_id + couverture)
  //   2. /standings?league=&season= -> position et points réels
  //   3. /fixtures?team=&season=  -> forme et derniers matchs réels
  //   4. (secours) /teams/statistics -> forme si les matchs sont indisponibles
  // Chaque étape est indépendante : si l'une échoue, les autres s'affichent
  // quand même, et la VRAIE raison est conservée dans `problems`.
  // Rien n'est jamais inventé : une donnée absente reste "Non disponible".
  const fetchTeamData = useCallback(
    async (teamId, { force = false } = {}) => {
      const currentSeason = seasonRef.current;
      const cached = teamDataRef.current[teamId] || loadTeamData(teamId, currentSeason);
      const ttl = cached?.isLive ? LIVE_CLIENT_TTL : CLIENT_DATA_TTL;
      // Une entrée en erreur ou incomplète n'est JAMAIS considérée comme fraîche.
      const isFresh =
        cached && !cached.error && !(cached.problems && cached.problems.length) && cached.timestamp && Date.now() - cached.timestamp < ttl;

      if (isFresh && !force) {
        setTeamData((prev) => ({ ...prev, [teamId]: cached }));
        if (cached.league?.id) {
          const t = loadTable(cached.league.id, currentSeason);
          if (t) setLeagueTables((prev) => (prev[cached.league.id] ? prev : { ...prev, [cached.league.id]: t }));
        }
        return cached;
      }

      setTeamData((prev) => ({
        ...prev,
        [teamId]: { ...(prev[teamId] || {}), loading: true, error: null },
      }));

      const team = rosterRef.current.find((t) => t.id === Number(teamId));
      const problems = [];

      // 1. Championnat national
      let league = null;
      let coverage = null;
      try {
        const leaguesResp = await getLeaguesForTeam(teamId, currentSeason);
        const picked = pickDomesticLeague(leaguesResp, team?.country, currentSeason);
        league = picked.league;
        coverage = picked.coverage;
        if (!league) problems.push(`Championnat : ${picked.reason}`);
        else if (picked.reason) problems.push(`Championnat : ${picked.reason}`);
      } catch (err) {
        problems.push(`Championnat : ${errMsg(err)}`);
      }

      // Secours : ancienne méthode, mais en gardant uniquement une ligue du pays de l'équipe.
      if (!league) {
        try {
          const resp = await getStandingsForTeam(teamId, currentSeason);
          const same = resp.find((r) => team?.country && r.league?.country === team.country) || null;
          if (same) {
            league = { id: same.league.id, name: same.league.name, logo: same.league.logo, country: same.league.country };
          }
        } catch {
          // la raison a déjà été notée ci-dessus
        }
      }

      // 2. Classement + 3. Matchs en parallèle
      const [standingsRes, fixturesRes] = await Promise.allSettled([
        league ? getStandingsForLeague(league.id, currentSeason) : Promise.resolve(null),
        getSeasonFixtures(teamId, currentSeason),
      ]);

      let standing = null;
      if (standingsRes.status === 'fulfilled' && standingsRes.value) {
        const { standing: st, table } = extractStandings(standingsRes.value, teamId);
        standing = st;
        if (table.length > 0 && league) {
          const slim = table.map(slimRow);
          saveTable(league.id, currentSeason, slim);
          if (seasonRef.current === currentSeason) setLeagueTables((prev) => ({ ...prev, [league.id]: slim }));
        }
        if (!st) {
          problems.push(
            table.length === 0
              ? `Classement : API-Football ne fournit pas de classement pour ${league?.name || 'ce championnat'} (saison ${currentSeason}).`
              : `Classement : l'équipe (ID ${teamId}) n'apparaît pas dans le classement de ${league?.name}.`
          );
        }
      } else if (standingsRes.status === 'rejected') {
        problems.push(`Classement : ${errMsg(standingsRes.reason)}`);
      }

      let fixtures = [];
      let nextFixtures = [];
      let fixturesOk = false;
      if (fixturesRes.status === 'fulfilled') {
        fixturesOk = true;
        const all = fixturesRes.value.fixtures;
        const byDateDesc = (a, b) => new Date(b.fixture.date) - new Date(a.fixture.date);
        fixtures = all.filter(isFixtureFinished).sort(byDateDesc).slice(0, DEFAULT_LAST_MATCHES);
        const live = all.filter(isFixtureLive);
        const upcoming = all
          .filter((f) => ['NS', 'TBD'].includes(f.fixture?.status?.short) && new Date(f.fixture.date) >= new Date())
          .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
        nextFixtures = [...live, ...upcoming].slice(0, 3);
        if (all.length === 0) problems.push(`Matchs : aucun match renvoyé par API-Football pour la saison ${currentSeason}.`);
      } else {
        problems.push(`Matchs : ${errMsg(fixturesRes.reason)}`);
      }

      // 4. Secours pour la forme : /teams/statistics (champ "form")
      let formFallback = null;
      if ((!fixturesOk || fixtures.length === 0) && league) {
        try {
          const stats = await getTeamStatistics(teamId, league.id, currentSeason);
          const f = stats?.form;
          if (f) formFallback = f.split('').slice(-5).reverse(); // le plus récent en premier
        } catch {
          // pas de donnée : on laisse "Non disponible"
        }
      }

      const isLive = nextFixtures.some(isFixtureLive);
      const failedEverything = !league && !standing && !fixturesOk;
      const entry = {
        loading: false,
        error: failedEverything ? problems.join(' | ') : null,
        problems,
        timestamp: Date.now(),
        season: currentSeason,
        isLive,
        league: league ? { ...league, coverage } : null,
        standing: standing ? slimRow(standing) : null,
        fixtures,
        nextFixtures,
        formFallback,
      };

      // Si la saison a changé pendant la requête, on ignore ce résultat obsolète.
      if (seasonRef.current !== currentSeason) return entry;

      setTeamData((prev) => ({ ...prev, [teamId]: entry }));
      // Seules les entrées COMPLÈTES sont conservées localement : une erreur
      // ne doit jamais rester affichée comme "fraîche" pendant des heures.
      if (problems.length === 0) saveTeamData(teamId, currentSeason, entry);

      if (league) {
        setRoster((prev) =>
          prev.map((t) =>
            t.id === Number(teamId)
              ? { ...t, leagueId: league.id, leagueName: league.name, leagueLogo: league.logo, leagueCountry: league.country }
              : t
          )
        );
      }

      if (fixturesOk || standing) touchLastUpdated();
      return entry;
    },
    [touchLastUpdated]
  );

  // --- Vérification / réparation des équipes déjà importées ---------------

  // Liste les équipes suspectes (nom féminin / jeune / réserve, ID connu
  // pour être faux, pays qui ne correspond pas au club).
  const getSuspiciousTeams = useCallback(() => rosterRef.current.filter(isSuspiciousTeam), []);

  // Pour chaque équipe suspecte, recherche les bons candidats (hommes,
  // bon pays) SANS rien modifier. Renvoie des propositions à valider.
  const verifyRoster = useCallback(async () => {
    const out = [];
    for (const team of rosterRef.current.filter(isSuspiciousTeam)) {
      const forced = FORCED_ID_FIXES[team.id];
      const baseName = forced ? forced.search : cleanTeamName(team.name);
      try {
        const seen = new Map();
        for (const term of searchTerms(baseName)) {
          // eslint-disable-next-line no-await-in-loop
          const list = await searchTeams(term);
          list.forEach((c) => seen.set(c.team.id, c));
        }
        const candidates = [...seen.values()];
        if (candidates.length === 0) {
          out.push({ team, status: 'not_found', best: null, alternatives: [] });
          continue;
        }
        const match = matchTeam(baseName, candidates);
        // Cas connu : on met en avant l'ID attendu s'il fait partie des candidats.
        if (forced && seen.has(forced.expectedId)) {
          out.push({ team, status: 'found', best: seen.get(forced.expectedId), alternatives: match.alternatives || [] });
        } else {
          out.push({ team, ...match });
        }
      } catch (err) {
        out.push({ team, status: 'error', error: errMsg(err), best: null, alternatives: [] });
      }
    }
    return out;
  }, []);

  // Remplace une équipe du roster par le bon club, en CONSERVANT le nom
  // choisi par l'utilisatrice. Les anciennes données mises en cache sont
  // supprimées pour que classement / matchs / forme repartent du bon ID.
  const repairTeam = useCallback((oldId, candidate) => {
    const newId = candidate.team.id;
    setRoster((prev) => {
      const alreadyThere = prev.some((t) => t.id === newId && t.id !== oldId);
      if (alreadyThere) return prev.filter((t) => t.id !== oldId); // doublon : on retire l'ancienne
      return prev.map((t) =>
        t.id === oldId
          ? { ...t, id: newId, country: candidate.team.country, logo: candidate.team.logo, leagueId: null, leagueName: null, leagueLogo: null, leagueCountry: null }
          : t
      );
    });
    setTeamData((prev) => {
      const next = { ...prev };
      delete next[oldId];
      delete next[newId];
      return next;
    });
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(`${TEAM_DATA_PREFIX}${oldId}:`) || k.startsWith(`${TEAM_DATA_PREFIX}${newId}:`))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
  }, []);

  // Charge les données de toutes les équipes du roster qui n'ont pas
  // encore de données fraîches (utilisé par le dashboard / actualiser tout).
  const refreshAll = useCallback(
    async ({ force = false } = {}) => {
      setGlobalError(null);
      for (const team of roster) {
        // séquentiel pour rester respectueux du quota API
        // eslint-disable-next-line no-await-in-loop
        await fetchTeamData(team.id, { force });
      }
    },
    [roster, fetchTeamData]
  );

  const clearAllData = useCallback(() => {
    setRoster([]);
    setTeamData({});
    localStorage.removeItem(ROSTER_KEY);
    Object.keys(localStorage)
      .filter((k) => k.startsWith(TEAM_DATA_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(LAST_UPDATED_KEY);
    setLastUpdated(null);
  }, []);

  // Changer de saison : on vide les données affichées (celles de l'ancienne
  // saison) et on relance la récupération pour toutes les équipes du
  // roster, sur la nouvelle saison. Le roster lui-même (liste d'équipes)
  // ne dépend pas de la saison et reste inchangé.
  const changeSeason = useCallback((newSeason) => {
    setSeasonState((prev) => {
      if (prev === newSeason) return prev;
      localStorage.setItem(SEASON_KEY, String(newSeason));
      return newSeason;
    });
    setTeamData({});
    setLeagueTables({});
  }, []);

  // Une fois la saison changée (pas au chargement initial — l'app reste
  // "lazy" comme avant : les données se chargent quand une page en a
  // besoin), recharge les données des équipes déjà suivies.
  const isFirstSeasonRender = useRef(true);
  useEffect(() => {
    if (isFirstSeasonRender.current) {
      isFirstSeasonRender.current = false;
      return;
    }
    roster.forEach((team) => fetchTeamData(team.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  // Actualisation automatique : uniquement les équipes ayant un match en
  // direct sont réinterrogées, à intervalle régulier, pour ne jamais
  // multiplier les appels API sur les équipes sans match en cours.
  useEffect(() => {
    const interval = setInterval(() => {
      const liveTeamIds = Object.entries(teamDataRef.current)
        .filter(([, d]) => d?.isLive)
        .map(([id]) => Number(id));
      liveTeamIds.forEach((id) => fetchTeamData(id, { force: true }));
    }, LIVE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchTeamData]);

  const value = useMemo(
    () => ({
      roster,
      teamData,
      leagueTables,
      season,
      availableSeasons,
      changeSeason,
      lastUpdated,
      globalError,
      resolveTeamNames,
      confirmTeam,
      removeTeam,
      getSuspiciousTeams,
      verifyRoster,
      repairTeam,
      fetchTeamData,
      refreshAll,
      clearAllData,
    }),
    [roster, teamData, leagueTables, season, availableSeasons, changeSeason, lastUpdated, globalError, resolveTeamNames, confirmTeam, removeTeam, getSuspiciousTeams, verifyRoster, repairTeam, fetchTeamData, refreshAll, clearAllData]
  );

  return <TeamsContext.Provider value={value}>{children}</TeamsContext.Provider>;
}

export function useTeams() {
  const ctx = useContext(TeamsContext);
  if (!ctx) throw new Error('useTeams doit être utilisé à l\'intérieur de <TeamsProvider>');
  return ctx;
}

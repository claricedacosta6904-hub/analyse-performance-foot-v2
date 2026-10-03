import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { searchTeams, getStandingsForTeam, getFixturesForTeam, getNextFixturesForTeam, ApiError } from '../services/api';
import { matchTeam } from '../utils/matching';
import { hasLiveFixture } from '../utils/liveStatus';
import { CURRENT_SEASON, DEFAULT_LAST_MATCHES } from '../data/config';

const TeamsContext = createContext(null);

const ROSTER_KEY = 'apf_roster_v1';
const TEAM_DATA_PREFIX = 'apf_team_data_'; // + teamId
const LAST_UPDATED_KEY = 'apf_last_updated';

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

function loadTeamData(teamId) {
  try {
    const raw = localStorage.getItem(TEAM_DATA_PREFIX + teamId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveTeamData(teamId, data) {
  try {
    localStorage.setItem(TEAM_DATA_PREFIX + teamId, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function TeamsProvider({ children }) {
  const [roster, setRoster] = useState(loadRoster);
  const [teamData, setTeamData] = useState({}); // { [teamId]: { standing, fixtures, nextFixtures, isLive, timestamp } }
  const [lastUpdated, setLastUpdated] = useState(() => localStorage.getItem(LAST_UPDATED_KEY) || null);
  const [globalError, setGlobalError] = useState(null);
  const teamDataRef = useRef(teamData);
  teamDataRef.current = teamData;

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
    localStorage.removeItem(TEAM_DATA_PREFIX + teamId);
  }, []);

  // Récupère (ou rafraîchit) les données classement + matchs d'une équipe.
  // Si un match en direct est détecté, les prochaines lectures utiliseront
  // un délai de fraîcheur beaucoup plus court (voir isFresh ci-dessous).
  const fetchTeamData = useCallback(
    async (teamId, { force = false } = {}) => {
      const cached = teamDataRef.current[teamId] || loadTeamData(teamId);
      const ttl = cached?.isLive ? LIVE_CLIENT_TTL : CLIENT_DATA_TTL;
      const isFresh = cached && cached.timestamp && Date.now() - cached.timestamp < ttl;

      if (isFresh && !force) {
        setTeamData((prev) => ({ ...prev, [teamId]: cached }));
        return cached;
      }

      setTeamData((prev) => ({
        ...prev,
        [teamId]: { ...(prev[teamId] || {}), loading: true, error: null },
      }));

      try {
        const [standingsResponse, pastResult, nextResult] = await Promise.all([
          getStandingsForTeam(teamId, CURRENT_SEASON),
          getFixturesForTeam(teamId, CURRENT_SEASON, DEFAULT_LAST_MATCHES),
          getNextFixturesForTeam(teamId, CURRENT_SEASON, 3),
        ]);

        // standingsResponse est un tableau de championnats (une équipe peut
        // apparaître dans plusieurs compétitions) ; on prend le premier,
        // qui correspond en général au championnat national.
        const leagueEntry = standingsResponse[0];
        const standingsTable = leagueEntry?.league?.standings?.[0] || [];
        const teamStanding = standingsTable.find((row) => row.team.id === Number(teamId)) || null;

        const fixtures = pastResult.fixtures;
        const nextFixtures = nextResult.fixtures;
        const isLive = hasLiveFixture(fixtures) || hasLiveFixture(nextFixtures);

        const entry = {
          loading: false,
          error: null,
          timestamp: Date.now(),
          isLive,
          league: leagueEntry?.league
            ? {
                id: leagueEntry.league.id,
                name: leagueEntry.league.name,
                logo: leagueEntry.league.logo,
                country: leagueEntry.league.country,
              }
            : null,
          standing: teamStanding,
          fixtures,
          nextFixtures,
        };

        setTeamData((prev) => ({ ...prev, [teamId]: entry }));
        saveTeamData(teamId, entry);

        // Met à jour le championnat de l'équipe dans le roster.
        if (entry.league) {
          setRoster((prev) =>
            prev.map((t) =>
              t.id === teamId
                ? { ...t, leagueId: entry.league.id, leagueName: entry.league.name, leagueLogo: entry.league.logo, leagueCountry: entry.league.country }
                : t
            )
          );
        }

        touchLastUpdated();
        return entry;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Impossible de récupérer les données actuellement.';
        const entry = { loading: false, error: message, timestamp: Date.now(), standing: null, fixtures: [], nextFixtures: [], league: null, isLive: false };
        setTeamData((prev) => ({ ...prev, [teamId]: entry }));
        return entry;
      }
    },
    [touchLastUpdated]
  );

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
      lastUpdated,
      globalError,
      resolveTeamNames,
      confirmTeam,
      removeTeam,
      fetchTeamData,
      refreshAll,
      clearAllData,
    }),
    [roster, teamData, lastUpdated, globalError, resolveTeamNames, confirmTeam, removeTeam, fetchTeamData, refreshAll, clearAllData]
  );

  return <TeamsContext.Provider value={value}>{children}</TeamsContext.Provider>;
}

export function useTeams() {
  const ctx = useContext(TeamsContext);
  if (!ctx) throw new Error('useTeams doit être utilisé à l\'intérieur de <TeamsProvider>');
  return ctx;
}

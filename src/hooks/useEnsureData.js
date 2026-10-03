import { useEffect, useState } from 'react';
import { useTeams } from '../context/TeamsContext';

// Charge (une seule fois, via le cache client + serveur) les données de
// chaque équipe du roster qui n'en a pas encore, puis indique quand
// c'est terminé. Utilisé par les pages qui ont besoin des données de
// TOUTES les équipes (Classement, Matchs, Forme, Domicile, Extérieur).
export function useEnsureAllTeamsData() {
  const { roster, teamData, fetchTeamData } = useTeams();
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setInitialLoading(true);
      for (const team of roster) {
        if (!teamData[team.id]) {
          // eslint-disable-next-line no-await-in-loop
          await fetchTeamData(team.id);
        }
        if (cancelled) return;
      }
      if (!cancelled) setInitialLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster.length]);

  return { initialLoading };
}

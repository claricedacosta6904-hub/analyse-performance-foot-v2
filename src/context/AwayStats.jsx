import { Download } from 'lucide-react';
import { useTeams } from '../context/TeamsContext';
import { useEnsureAllTeamsData } from '../hooks/useEnsureData';
import { computeAwayStats } from '../utils/calculations';
import { EmptyState, fmt } from '../components/StatusMessage';
import { exportToCSV } from '../utils/csvExport';

export default function AwayStats() {
  const { roster, teamData } = useTeams();
  useEnsureAllTeamsData();

  if (roster.length === 0) {
    return <div className="card"><EmptyState title="Aucune équipe" description="Ajoute des équipes pour voir leurs performances à l'extérieur." /></div>;
  }

  const rows = roster.map((t) => ({ team: t, stats: computeAwayStats(teamData[t.id]?.fixtures || [], t.id, 5) }));

  const handleExport = () => exportToCSV('exterieur.csv', rows.map((r) => ({
    Equipe: r.team.name,
    Victoires: r.stats.wins,
    Nuls: r.stats.draws,
    Defaites: r.stats.losses,
    Buts_marques: r.stats.goalsFor,
    Buts_encaisses: r.stats.goalsAgainst,
    Points: r.stats.points,
    Reussite_pourcent: r.stats.formPercent,
  })));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Extérieur</h1>
          <p className="page-subtitle">Performances sur les 5 derniers matchs à l'extérieur</p>
        </div>
        <button className="btn" onClick={handleExport}><Download size={16} /> Exporter CSV</button>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr><th>ÉQUIPE</th><th>V</th><th>N</th><th>D</th><th>BUTS MARQUÉS</th><th>BUTS ENCAISSÉS</th><th>POINTS</th><th>RÉUSSITE</th></tr>
          </thead>
          <tbody>
            {rows.map(({ team, stats }) => (
              <tr key={team.id}>
                <td>{team.name}</td>
                <td>{stats.wins}</td>
                <td>{stats.draws}</td>
                <td>{stats.losses}</td>
                <td>{stats.goalsFor}</td>
                <td>{stats.goalsAgainst}</td>
                <td style={{ fontWeight: 700 }}>{stats.points}</td>
                <td style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>{stats.played ? fmt(stats.formPercent, '%') : 'Non disponible'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

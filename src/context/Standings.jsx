import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useTeams } from '../context/TeamsContext';
import { useEnsureAllTeamsData } from '../hooks/useEnsureData';
import { EmptyState, fmt } from '../components/StatusMessage';
import { exportToCSV } from '../utils/csvExport';

export default function Standings() {
  const { roster, teamData } = useTeams();
  const { initialLoading } = useEnsureAllTeamsData();

  const leagues = useMemo(() => {
    const map = new Map();
    roster.forEach((t) => {
      const d = teamData[t.id];
      if (!d?.league) return;
      if (!map.has(d.league.id)) map.set(d.league.id, { league: d.league, teamIds: new Set() });
      map.get(d.league.id).teamIds.add(t.id);
    });
    return [...map.values()];
  }, [roster, teamData]);

  const [selectedLeague, setSelectedLeague] = useState(null);
  const active = leagues.find((l) => l.league.id === selectedLeague) || leagues[0];

  if (roster.length === 0) {
    return <div className="card"><EmptyState title="Aucune équipe" description="Ajoute des équipes pour voir leur classement." /></div>;
  }

  if (initialLoading && leagues.length === 0) {
    return <div className="card"><p style={{ color: 'var(--text-dim)' }}>Chargement des classements...</p></div>;
  }

  const handleExport = () => {
    if (!active) return;
    const table = active.league.standings?.[0] || [];
    exportToCSV(
      `classement-${active.league.name}.csv`,
      table.map((row) => ({
        Position: row.rank,
        Equipe: row.team.name,
        MJ: row.all.played,
        V: row.all.win,
        N: row.all.draw,
        D: row.all.lose,
        BP: row.all.goals.for,
        BC: row.all.goals.against,
        Diff: row.goalsDiff,
        Points: row.points,
      }))
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Classement</h1>
          <p className="page-subtitle">Sélectionne un championnat</p>
        </div>
        <button className="btn" onClick={handleExport} disabled={!active}><Download size={16} /> Exporter CSV</button>
      </div>

      <div className="btn-row" style={{ marginBottom: 16 }}>
        {leagues.map((l) => (
          <button
            key={l.league.id}
            className="btn"
            style={{ borderColor: active?.league.id === l.league.id ? 'var(--accent)' : undefined }}
            onClick={() => setSelectedLeague(l.league.id)}
          >
            {l.league.name}
          </button>
        ))}
      </div>

      {active && <StandingsTable league={active.league} highlightIds={[...active.teamIds]} />}
    </div>
  );
}

function StandingsTable({ league, highlightIds }) {
  const table = league.standings?.[0] || [];
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>POS</th><th>ÉQUIPE</th><th>MJ</th><th>V</th><th>N</th><th>D</th><th>BP</th><th>BC</th><th>DIFF</th><th>PTS</th>
          </tr>
        </thead>
        <tbody>
          {table.map((row) => {
            const highlighted = highlightIds.includes(row.team.id);
            return (
              <tr key={row.team.id} style={highlighted ? { background: 'var(--accent-soft)' } : undefined}>
                <td style={{ fontWeight: 700, color: 'var(--accent-strong)' }}>{row.rank}</td>
                <td>{row.team.name}</td>
                <td>{fmt(row.all?.played)}</td>
                <td>{fmt(row.all?.win)}</td>
                <td>{fmt(row.all?.draw)}</td>
                <td>{fmt(row.all?.lose)}</td>
                <td>{fmt(row.all?.goals?.for)}</td>
                <td>{fmt(row.all?.goals?.against)}</td>
                <td style={{ fontWeight: 600 }}>{fmt(row.goalsDiff)}</td>
                <td style={{ fontWeight: 700 }}>{fmt(row.points)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import { Download } from 'lucide-react';
import { useTeams } from '../context/TeamsContext';
import { useEnsureAllTeamsData } from '../hooks/useEnsureData';
import { computeFormStats } from '../utils/calculations';
import { FormSequence } from '../components/FormBadge';
import { EmptyState, fmt } from '../components/StatusMessage';
import { exportToCSV } from '../utils/csvExport';

export default function FormPage() {
  const { roster, teamData } = useTeams();
  useEnsureAllTeamsData();

  if (roster.length === 0) {
    return <div className="card"><EmptyState title="Aucune équipe" description="Ajoute des équipes pour voir leur forme." /></div>;
  }

  const rows = roster.map((t) => {
    const fixtures = teamData[t.id]?.fixtures || [];
    const form = computeFormStats(fixtures.slice(0, 5), t.id);
    return { team: t, form };
  });

  const handleExport = () => exportToCSV('forme.csv', rows.map((r) => ({
    Equipe: r.team.name,
    Victoires: r.form.wins,
    Nuls: r.form.draws,
    Defaites: r.form.losses,
    Points: `${r.form.points}/${r.form.maxPoints}`,
    Forme_pourcent: r.form.formPercent,
  })));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Forme</h1>
          <p className="page-subtitle">5 derniers matchs par équipe — victoire = 3 pts, nul = 1 pt, défaite = 0 pt</p>
        </div>
        <button className="btn" onClick={handleExport}><Download size={16} /> Exporter CSV</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map(({ team, form }) => (
          <div key={team.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{team.name}</div>
              <FormSequence sequence={form.sequence} />
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <MiniStat label="V / N / D" value={`${form.wins} / ${form.draws} / ${form.losses}`} />
              <MiniStat label="POINTS" value={`${form.points} / ${form.maxPoints}`} />
              <MiniStat label="FORME" value={fmt(form.formPercent, '%')} highlight />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value, highlight }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: highlight ? 'var(--accent-strong)' : 'var(--text)' }}>{value}</div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useTeams } from '../context/TeamsContext';
import { useEnsureAllTeamsData } from '../hooks/useEnsureData';
import { computeFormStats, computeHomeStats, computeAwayStats } from '../utils/calculations';
import { FormSequence } from '../components/FormBadge';
import { EmptyState, fmt } from '../components/StatusMessage';

export default function Analysis() {
  const { roster, teamData } = useTeams();
  useEnsureAllTeamsData();
  const [selectedIds, setSelectedIds] = useState([]);

  const toggleTeam = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev));
  };

  const selectedTeams = roster.filter((t) => selectedIds.includes(t.id));

  const comparison = useMemo(
    () =>
      selectedTeams.map((t) => {
        const fixtures = teamData[t.id]?.fixtures || [];
        return {
          team: t,
          standing: teamData[t.id]?.standing,
          form: computeFormStats(fixtures.slice(0, 5), t.id),
          home: computeHomeStats(fixtures, t.id, 5),
          away: computeAwayStats(fixtures, t.id, 5),
        };
      }),
    [selectedTeams, teamData]
  );

  const chartData = comparison.map((c) => ({
    name: c.team.name.length > 12 ? `${c.team.name.slice(0, 11)}…` : c.team.name,
    Points: c.standing?.points ?? 0,
    'Forme %': c.form.formPercent,
  }));

  if (roster.length === 0) {
    return <div className="card"><EmptyState title="Aucune équipe" description="Ajoute des équipes pour pouvoir les comparer." /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analyse</h1>
          <p className="page-subtitle">Sélectionne jusqu'à 5 équipes à comparer</p>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {roster.map((t) => (
            <button
              key={t.id}
              className="btn"
              style={{ borderColor: selectedIds.includes(t.id) ? 'var(--accent)' : undefined, background: selectedIds.includes(t.id) ? 'var(--accent-soft)' : undefined }}
              onClick={() => toggleTeam(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {comparison.length === 0 ? (
        <div className="card"><EmptyState title="Aucune équipe sélectionnée" description="Choisis au moins une équipe ci-dessus pour lancer la comparaison." /></div>
      ) : (
        <>
          <div className="card" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" stroke="var(--text-faint)" fontSize={11} />
                <YAxis stroke="var(--text-faint)" fontSize={11} />
                <Tooltip contentStyle={{ background: '#0F1626', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="Points" fill="#3D6BFF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Forme %" fill="#35C980" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ÉQUIPE</th><th>CLASSEMENT</th><th>POINTS</th><th>FORME (5)</th><th>BUTS MARQUÉS (5)</th><th>BUTS ENCAISSÉS (5)</th><th>DOMICILE (V/N/D)</th><th>EXTÉRIEUR (V/N/D)</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((c) => (
                  <tr key={c.team.id}>
                    <td style={{ fontWeight: 600 }}>{c.team.name}</td>
                    <td>{fmt(c.standing?.rank)}</td>
                    <td>{fmt(c.standing?.points)}</td>
                    <td><FormSequence sequence={c.form.sequence} /></td>
                    <td>{c.form.goalsFor}</td>
                    <td>{c.form.goalsAgainst}</td>
                    <td>{c.home.wins} / {c.home.draws} / {c.home.losses}</td>
                    <td>{c.away.wins} / {c.away.draws} / {c.away.losses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

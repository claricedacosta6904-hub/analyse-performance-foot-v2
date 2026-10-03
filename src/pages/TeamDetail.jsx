import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useTeams } from '../context/TeamsContext';
import { computeFormStats } from '../utils/calculations';
import { isFixtureLive } from '../utils/liveStatus';
import { FormSequence, ResultPill } from '../components/FormBadge';
import { fmt, Skeleton, StatusMessage } from '../components/StatusMessage';

export default function TeamDetail() {
  const { id } = useParams();
  const teamId = Number(id);
  const navigate = useNavigate();
  const { roster, teamData, fetchTeamData, removeTeam } = useTeams();

  const team = roster.find((t) => t.id === teamId);
  const data = teamData[teamId];

  useEffect(() => {
    if (!data) fetchTeamData(teamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  if (!team) {
    return (
      <div className="card">
        <StatusMessage type="warning">Cette équipe n'est plus dans ta liste.</StatusMessage>
      </div>
    );
  }

  const form = data?.fixtures ? computeFormStats(data.fixtures.slice(0, 5), teamId) : null;

  return (
    <div>
      <button className="btn" onClick={() => navigate('/equipes')} style={{ marginBottom: 16 }}>
        <ArrowLeft size={15} /> Retour aux équipes
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">{team.name}</h1>
          <p className="page-subtitle">{fmt(team.leagueName)} — {fmt(team.country)}</p>
        </div>
        <button
          className="btn btn-danger"
          onClick={() => {
            if (confirm(`Retirer ${team.name} de ta liste ?`)) {
              removeTeam(teamId);
              navigate('/equipes');
            }
          }}
        >
          <Trash2 size={15} /> Retirer
        </button>
      </div>

      {data?.error && <StatusMessage type="error">{data.error}</StatusMessage>}
      {data?._warning && <StatusMessage type="warning">{data._warning}</StatusMessage>}

      {data?.loading || !data ? (
        <div className="card"><Skeleton height={120} /></div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card"><span className="value">{fmt(data.standing?.rank)}</span><span className="label">POSITION</span></div>
            <div className="stat-card"><span className="value">{fmt(data.standing?.points)}</span><span className="label">POINTS</span></div>
            <div className="stat-card"><span className="value">{fmt(form?.formPercent, '%')}</span><span className="label">FORME (5 MATCHS)</span></div>
            <div className="stat-card"><span className="value">{fmt(data.standing?.goalsDiff)}</span><span className="label">DIFF. DE BUTS</span></div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>Forme récente</h3>
            <FormSequence sequence={form?.sequence || []} />
          </div>

          {(data.nextFixtures || []).length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>Prochains matchs</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.nextFixtures.map((f) => {
                  const isHome = f.teams.home.id === teamId;
                  const opponent = isHome ? f.teams.away.name : f.teams.home.name;
                  const live = isFixtureLive(f);
                  return (
                    <div key={f.fixture.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                      <span>{isHome ? 'vs' : '@'} {opponent}</span>
                      {live ? (
                        <span className="pill pill-draw">EN DIRECT — {f.goals.home ?? 0} - {f.goals.away ?? 0}</span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>{new Date(f.fixture.date).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="card">
            <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>Derniers matchs</h3>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>DATE</th><th>ADVERSAIRE</th><th>LIEU</th><th>SCORE</th><th>RÉSULTAT</th></tr></thead>
                <tbody>
                  {(data.fixtures || []).map((f) => {
                    const isHome = f.teams.home.id === teamId;
                    const opponent = isHome ? f.teams.away.name : f.teams.home.name;
                    const result = f.goals.home === null ? null : (
                      (isHome ? f.goals.home : f.goals.away) > (isHome ? f.goals.away : f.goals.home) ? 'W' :
                      (isHome ? f.goals.home : f.goals.away) === (isHome ? f.goals.away : f.goals.home) ? 'D' : 'L'
                    );
                    return (
                      <tr key={f.fixture.id}>
                        <td>{new Date(f.fixture.date).toLocaleDateString('fr-FR')}</td>
                        <td>{opponent}</td>
                        <td>{isHome ? 'Domicile' : 'Extérieur'}</td>
                        <td>{f.goals.home === null ? 'Non disponible' : `${f.goals.home} - ${f.goals.away}`}</td>
                        <td><ResultPill result={result} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

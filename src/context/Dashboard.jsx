import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTeams } from '../context/TeamsContext';
import { EmptyState } from '../components/StatusMessage';

function formatDate(iso) {
  if (!iso) return 'Jamais';
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { roster, teamData, lastUpdated, refreshAll } = useTeams();
  const [refreshing, setRefreshing] = useState(false);

  const leagueCount = useMemo(
    () => new Set(roster.map((t) => t.leagueId).filter(Boolean)).size,
    [roster]
  );

  const matchesAnalyzed = useMemo(
    () => Object.values(teamData).reduce((sum, d) => sum + (d?.fixtures?.length || 0), 0),
    [teamData]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">ANALYSE DE PERFORMANCE FOOT</h1>
          <p className="page-subtitle">Analyse automatique des performances des équipes</p>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => navigate('/ajouter-equipes')}>
            <Plus size={16} /> Ajouter des équipes
          </button>
          <button className="btn" onClick={handleRefresh} disabled={refreshing || roster.length === 0}>
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} /> Actualiser les données
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="value">{roster.length}</span>
          <span className="label">ÉQUIPES</span>
        </div>
        <div className="stat-card">
          <span className="value">{leagueCount}</span>
          <span className="label">CHAMPIONNATS</span>
        </div>
        <div className="stat-card">
          <span className="value">{matchesAnalyzed}</span>
          <span className="label">MATCHS ANALYSÉS</span>
        </div>
        <div className="stat-card">
          <span className="value" style={{ fontSize: '1.1rem' }}>{formatDate(lastUpdated)}</span>
          <span className="label">DERNIÈRE ACTUALISATION</span>
        </div>
      </div>

      {roster.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Aucune équipe pour le moment"
            description="Ajoute ta liste d'équipes pour démarrer l'analyse automatique."
            action={
              <button className="btn btn-primary" onClick={() => navigate('/ajouter-equipes')}>
                <Plus size={16} /> Ajouter des équipes
              </button>
            }
          />
        </div>
      ) : (
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', marginBottom: 14 }}>Équipes suivies</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {roster.map((t) => (
              <span key={t.id} className="pill pill-neutral" style={{ cursor: 'pointer' }} onClick={() => navigate(`/equipes/${t.id}`)}>
                {t.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { useTeams } from '../context/TeamsContext';
import { StatusMessage } from '../components/StatusMessage';

export default function SettingsPage() {
  const { roster, lastUpdated, refreshAll, clearAllData, season, availableSeasons, changeSeason } = useTeams();
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshAll({ force: true });
    setRefreshing(false);
    setMessage({ type: 'info', text: 'Données actualisées.' });
  };

  const handleClearServerCache = async () => {
    setClearing(true);
    try {
      const res = await fetch('/.netlify/functions/clear-cache', { method: 'POST' });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMessage({ type: 'info', text: `Cache serveur vidé (${json.cleared} entrée(s)).` });
    } catch (err) {
      setMessage({ type: 'error', text: "Impossible de vider le cache serveur pour le moment." });
    }
    setClearing(false);
  };

  const handleClearLocal = () => {
    if (!confirm('Supprimer toutes tes équipes et données locales ? Cette action est irréversible.')) return;
    clearAllData();
    setMessage({ type: 'info', text: 'Toutes les données locales ont été supprimées.' });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Paramètres</h1>
        </div>
      </div>

      {message && <StatusMessage type={message.type}>{message.text}</StatusMessage>}

      <div className="stat-grid">
        <div className="stat-card"><span className="value">{season}</span><span className="label">SAISON ACTUELLE</span></div>
        <div className="stat-card"><span className="value">{roster.length}</span><span className="label">NOMBRE D'ÉQUIPES</span></div>
        <div className="stat-card">
          <span className="value" style={{ fontSize: '1.1rem' }}>{lastUpdated ? new Date(lastUpdated).toLocaleString('fr-FR') : 'Jamais'}</span>
          <span className="label">DERNIÈRE ACTUALISATION</span>
        </div>
        <div className="stat-card"><span className="value" style={{ fontSize: '1.1rem' }}>Connectée</span><span className="label">ÉTAT DE L'API</span></div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>Saison</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.86rem', marginBottom: 12 }}>
          La saison en cours est détectée automatiquement (elle passera à {season + 1} dès le début de la prochaine saison). Tu peux aussi consulter une saison précédente :
        </p>
        <select value={season} onChange={(e) => changeSeason(Number(e.target.value))}>
          {availableSeasons.map((s) => (
            <option key={s} value={s}>{s}-{s + 1}{s === availableSeasons[0] ? ' (actuelle)' : ''}</option>
          ))}
        </select>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>Données</h3>
        <div className="btn-row">
          <button className="btn" onClick={handleRefresh} disabled={refreshing || roster.length === 0}>
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} /> Actualiser les données
          </button>
          <button className="btn btn-danger" onClick={handleClearServerCache} disabled={clearing}>
            <Trash2 size={16} /> Vider le cache serveur
          </button>
          <button className="btn btn-danger" onClick={handleClearLocal}>
            <Trash2 size={16} /> Vider mes équipes et données locales
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>Sécurité</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.86rem' }}>
          La clé API n'est jamais affichée ici : elle reste stockée côté serveur, dans la variable d'environnement Netlify API_FOOTBALL_KEY.
        </p>
      </div>
    </div>
  );
}

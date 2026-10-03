import { useNavigate } from 'react-router-dom';
import { Search, RefreshCw, Settings } from 'lucide-react';
import { useState } from 'react';
import { useTeams } from '../context/TeamsContext';
import DataStatusBadge from './DataStatusBadge';

export default function Header() {
  const navigate = useNavigate();
  const { roster, refreshAll } = useTeams();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) navigate(`/equipes?q=${encodeURIComponent(query.trim())}`);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  return (
    <header className="app-header">
      <form onSubmit={handleSearch} className="header-search">
        <Search size={15} strokeWidth={1.8} color="var(--text-faint)" />
        <input
          type="text"
          placeholder="Rechercher une équipe..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      <div className="header-actions">
        <DataStatusBadge />
        <button className="btn" onClick={handleRefresh} disabled={refreshing || roster.length === 0}>
          <RefreshCw size={15} strokeWidth={1.8} className={refreshing ? 'spin' : ''} />
          <span className="hide-mobile">{refreshing ? 'Actualisation...' : 'Actualiser'}</span>
        </button>
        <button className="btn icon-only" onClick={() => navigate('/parametres')} aria-label="Paramètres">
          <Settings size={15} strokeWidth={1.8} />
        </button>
      </div>

      <style>{`
        .app-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .header-search {
          display: flex;
          align-items: center;
          gap: 9px;
          background: var(--card);
          border: 1px solid var(--card-border-strong);
          border-radius: 10px;
          padding: 8px 14px;
          flex: 1;
          min-width: 200px;
          max-width: 360px;
        }
        .header-search input {
          background: transparent;
          border: none;
          padding: 0;
          flex: 1;
          font-size: 0.86rem;
        }
        .header-search input:focus { border: none; }
        .header-actions {
          display: flex;
          gap: 8px;
        }
        .icon-only { padding: 10px; }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 560px) {
          .hide-mobile { display: none; }
        }
      `}</style>
    </header>
  );
}

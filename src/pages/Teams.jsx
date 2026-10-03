import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus } from 'lucide-react';
import { useTeams } from '../context/TeamsContext';
import { useEnsureAllTeamsData } from '../hooks/useEnsureData';
import { FormSequence } from '../components/FormBadge';
import { EmptyState, fmt, Skeleton } from '../components/StatusMessage';
import { exportToCSV } from '../utils/csvExport';
import { computeFormStats } from '../utils/calculations';

export default function Teams() {
  const navigate = useNavigate();
  const { roster, teamData } = useTeams();
  const { initialLoading } = useEnsureAllTeamsData();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [countryFilter, setCountryFilter] = useState('');
  const [leagueFilter, setLeagueFilter] = useState('');

  const countries = useMemo(() => [...new Set(roster.map((t) => t.country).filter(Boolean))].sort(), [roster]);
  const leagues = useMemo(() => [...new Set(roster.map((t) => t.leagueName).filter(Boolean))].sort(), [roster]);

  const rows = useMemo(() => {
    return roster
      .filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
      .filter((t) => !countryFilter || t.country === countryFilter)
      .filter((t) => !leagueFilter || t.leagueName === leagueFilter)
      .map((t, i) => {
        const data = teamData[t.id];
        const form = data?.fixtures ? computeFormStats(data.fixtures.slice(0, 5), t.id) : null;
        return { index: i + 1, team: t, standing: data?.standing, form, loading: data?.loading };
      });
  }, [roster, query, countryFilter, leagueFilter, teamData]);

  const handleExport = () => {
    exportToCSV(
      'equipes.csv',
      rows.map((r) => ({
        Equipe: r.team.name,
        Championnat: r.team.leagueName || '',
        Pays: r.team.country || '',
        ID_API: r.team.id,
        Position: r.standing?.rank ?? '',
        Points: r.standing?.points ?? '',
      }))
    );
  };

  if (roster.length === 0) {
    return (
      <div className="card">
        <EmptyState
          title="Aucune équipe"
          description="Ajoute des équipes pour voir apparaître le tableau ici."
          action={<button className="btn btn-primary" onClick={() => navigate('/ajouter-equipes')}><Plus size={16} /> Ajouter des équipes</button>}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Équipes</h1>
          <p className="page-subtitle">{roster.length} équipe(s) suivie(s)</p>
        </div>
        <button className="btn" onClick={handleExport}><Download size={16} /> Exporter CSV</button>
      </div>

      <div className="btn-row" style={{ marginBottom: 16 }}>
        <input type="text" placeholder="Rechercher une équipe..." value={query} onChange={(e) => setQuery(e.target.value)} style={{ minWidth: 200 }} />
        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
          <option value="">Tous les pays</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={leagueFilter} onChange={(e) => setLeagueFilter(e.target.value)}>
          <option value="">Tous les championnats</option>
          {leagues.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th><th>ÉQUIPE</th><th>CHAMPIONNAT</th><th>PAYS</th><th>ID API</th><th>FORME</th><th>POSITION</th><th>POINTS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.team.id} className="clickable" onClick={() => navigate(`/equipes/${r.team.id}`)}>
                <td>{r.index}</td>
                <td>{r.team.name}</td>
                <td>{fmt(r.team.leagueName)}</td>
                <td>{fmt(r.team.country)}</td>
                <td>{r.team.id}</td>
                <td>{r.loading ? <Skeleton width={70} height={18} /> : <FormSequence sequence={r.form?.sequence || []} />}</td>
                <td>{fmt(r.standing?.rank)}</td>
                <td>{fmt(r.standing?.points)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {initialLoading && <p style={{ color: 'var(--text-faint)', fontSize: '0.8rem', marginTop: 10 }}>Chargement des données en cours...</p>}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus, AlertTriangle } from 'lucide-react';
import { useTeams } from '../context/TeamsContext';
import { useEnsureAllTeamsData } from '../hooks/useEnsureData';
import { FormSequence } from '../components/FormBadge';
import { EmptyState, fmt, Skeleton, StatusMessage } from '../components/StatusMessage';
import { exportToCSV } from '../utils/csvExport';
import { computeFormStats } from '../utils/calculations';
import { isSuspiciousTeam } from '../utils/matching';

export default function Teams() {
  const navigate = useNavigate();
  const { roster, teamData, season, fetchTeamData } = useTeams();
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
        const fromFixtures = data?.fixtures?.length ? computeFormStats(data.fixtures.slice(0, 5), t.id) : null;
        // Forme : vrais matchs d'abord ; sinon "form" de /teams/statistics ; sinon rien.
        const sequence = fromFixtures?.sequence?.length ? fromFixtures.sequence : data?.formFallback || [];
        const league = data?.league?.name || t.leagueName;
        const leagueCountryMismatch = data?.league?.country && t.country && data.league.country !== t.country;
        return {
          index: i + 1,
          team: t,
          standing: data?.standing,
          sequence,
          league,
          loading: data?.loading,
          problems: data?.problems || [],
          error: data?.error,
          suspicious: isSuspiciousTeam(t) || !!leagueCountryMismatch,
        };
      });
  }, [roster, query, countryFilter, leagueFilter, teamData]);

  const suspiciousCount = roster.filter(isSuspiciousTeam).length;
  // Raisons réelles (dédoublonnées) pour lesquelles certaines cases sont vides.
  const reasons = useMemo(() => {
    const set = new Map();
    rows.forEach((r) => (r.error ? [r.error] : r.problems).forEach((m) => set.set(m, (set.get(m) || 0) + 1)));
    return [...set.entries()].slice(0, 4);
  }, [rows]);

  const handleExport = () => {
    exportToCSV(
      'equipes.csv',
      rows.map((r) => ({
        Equipe: r.team.name,
        Championnat: r.league || '',
        ID_Championnat: teamData[r.team.id]?.league?.id ?? r.team.leagueId ?? '',
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

      {suspiciousCount > 0 && (
        <StatusMessage type="warning">
          {suspiciousCount} équipe(s) semblent mal associées (équipe féminine, jeune, mauvais pays...).{' '}
          <a href="/verifier-equipes" onClick={(e) => { e.preventDefault(); navigate('/verifier-equipes'); }} style={{ textDecoration: 'underline' }}>
            Vérifier et corriger
          </a>
        </StatusMessage>
      )}
      {!initialLoading && reasons.length > 0 && (
        <StatusMessage type="warning">
          Certaines données sont indisponibles (saison {season}) : {reasons.map(([m, n]) => `${m}${n > 1 ? ` (×${n})` : ''}`).join(' — ')}
        </StatusMessage>
      )}

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
                <td>{r.suspicious && <AlertTriangle size={13} color="var(--draw)" style={{ marginRight: 5, verticalAlign: '-2px' }} />}{r.team.name}</td>
                <td>{r.loading ? <Skeleton width={90} height={14} /> : fmt(r.league)}</td>
                <td>{fmt(r.team.country)}</td>
                <td>{r.team.id}</td>
                <td>{r.loading ? <Skeleton width={70} height={18} /> : <FormSequence sequence={r.sequence} />}</td>
                <td>{r.loading ? <Skeleton width={30} height={14} /> : fmt(r.standing?.rank)}</td>
                <td>{r.loading ? <Skeleton width={30} height={14} /> : fmt(r.standing?.points)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {initialLoading && <p style={{ color: 'var(--text-faint)', fontSize: '0.8rem', marginTop: 10 }}>Chargement des données en cours...</p>}
    </div>
  );
}

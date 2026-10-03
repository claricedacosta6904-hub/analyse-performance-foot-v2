import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useTeams } from '../context/TeamsContext';
import { useEnsureAllTeamsData } from '../hooks/useEnsureData';
import { getResult } from '../utils/calculations';
import { isFixtureLive } from '../utils/liveStatus';
import { ResultPill } from '../components/FormBadge';
import { EmptyState, fmt } from '../components/StatusMessage';
import { exportToCSV } from '../utils/csvExport';

export default function Matches() {
  const { roster, teamData } = useTeams();
  useEnsureAllTeamsData();
  const [selectedTeam, setSelectedTeam] = useState('all');

  const rows = useMemo(() => {
    const teams = selectedTeam === 'all' ? roster : roster.filter((t) => t.id === Number(selectedTeam));
    const out = [];
    teams.forEach((t) => {
      const fixtures = teamData[t.id]?.fixtures || [];
      fixtures.forEach((f) => {
        const isHome = f.teams.home.id === t.id;
        out.push({
          date: f.fixture.date,
          team: t.name,
          opponent: isHome ? f.teams.away.name : f.teams.home.name,
          venue: isHome ? 'Domicile' : 'Extérieur',
          score: f.goals.home === null ? null : `${f.goals.home} - ${f.goals.away}`,
          result: getResult(f, t.id),
          live: isFixtureLive(f),
        });
      });
    });
    return out.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [roster, teamData, selectedTeam]);

  if (roster.length === 0) {
    return <div className="card"><EmptyState title="Aucune équipe" description="Ajoute des équipes pour voir leurs matchs." /></div>;
  }

  const handleExport = () => exportToCSV('matchs.csv', rows.map((r) => ({
    Date: new Date(r.date).toLocaleDateString('fr-FR'),
    Equipe: r.team,
    Adversaire: r.opponent,
    Lieu: r.venue,
    Score: r.score || '',
    Resultat: r.result || '',
  })));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Matchs</h1>
          <p className="page-subtitle">Derniers matchs des équipes suivies</p>
        </div>
        <button className="btn" onClick={handleExport}><Download size={16} /> Exporter CSV</button>
      </div>

      <div className="btn-row" style={{ marginBottom: 16 }}>
        <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}>
          <option value="all">Toutes les équipes</option>
          {roster.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>DATE</th><th>ÉQUIPE</th><th>ADVERSAIRE</th><th>DOMICILE / EXTÉRIEUR</th><th>SCORE</th><th>RÉSULTAT</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{new Date(r.date).toLocaleDateString('fr-FR')}</td>
                <td>{r.team}</td>
                <td>{r.opponent}</td>
                <td>{r.venue}</td>
                <td>{fmt(r.score)}</td>
                <td>{r.live ? <span className="pill pill-draw">EN DIRECT</span> : <ResultPill result={r.result} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

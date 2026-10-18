import { useEffect, useState } from 'react';
import { Check, AlertTriangle, X, Upload } from 'lucide-react';
import { useTeams } from '../context/TeamsContext';
import { StatusMessage } from '../components/StatusMessage';
import { getLeaguesForTeam } from '../services/api';
import { pickDomesticLeague } from '../utils/leagueSelect';

export default function ImportTeams() {
  const { resolveTeamNames, confirmTeam, roster, season } = useTeams();
  const [raw, setRaw] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    const names = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    if (names.length === 0) return;
    setLoading(true);
    const res = await resolveTeamNames(names);
    setResults(res);
    setLoading(false);
  };

  const handleConfirm = (index, candidate) => {
    confirmTeam(candidate);
    setResults((prev) =>
      prev.map((r, i) => (i === index ? { ...r, status: 'confirmed_added', best: candidate } : r))
    );
  };

  const alreadyInRoster = (teamId) => roster.some((t) => t.id === teamId);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ajoute tes équipes</h1>
          <p className="page-subtitle">Colle une équipe par ligne — l'application retrouve automatiquement la bonne équipe côté API.</p>
        </div>
      </div>

      <div className="card">
        <textarea
          placeholder={'Barcelona\nReal Madrid\nAtl. Madrid\nArsenal\nManchester City\nParis SG\n...'}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-primary" onClick={handleImport} disabled={loading || !raw.trim()}>
            <Upload size={16} /> {loading ? 'Recherche en cours...' : 'Importer les équipes'}
          </button>
        </div>
      </div>

      {results && (
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', marginBottom: 16 }}>Résultats ({results.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {results.map((r, i) => (
              <ImportRow key={`${r.inputName}-${i}`} result={r} onConfirm={(c) => handleConfirm(i, c)} inRoster={alreadyInRoster} season={season} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ImportRow({ result, onConfirm, inRoster, season }) {
  if (result.status === 'error') {
    return (
      <div className="import-row">
        <RowHeader icon={<X size={15} color="var(--loss)" />} name={result.inputName} />
        <StatusMessage type="error">{result.error}</StatusMessage>
      </div>
    );
  }

  if (result.status === 'not_found') {
    return (
      <div className="import-row">
        <RowHeader icon={<X size={15} color="var(--loss)" />} name={result.inputName} />
        <StatusMessage type="warning">Cette équipe n'a pas été trouvée.</StatusMessage>
      </div>
    );
  }

  if (result.status === 'confirmed_added') {
    return (
      <div className="import-row">
        <RowHeader icon={<Check size={15} color="var(--win)" />} name={result.inputName} />
        <StatusMessage type="info">
          Ajoutée : {result.best.team.name} — {result.best.team.country}
        </StatusMessage>
      </div>
    );
  }

  if (result.status === 'found') {
    const already = inRoster(result.best.team.id);
    return (
      <div className="import-row">
        <RowHeader icon={<Check size={15} color="var(--win)" />} name={result.inputName} />
        <div className="found-line">
          <CandidateInfo candidate={result.best} season={season} />
          {already ? (
            <span className="pill pill-neutral">Déjà ajoutée</span>
          ) : (
            <button className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={() => onConfirm(result.best)}>
              Confirmer
            </button>
          )}
        </div>
      </div>
    );
  }

  // ambiguous
  return (
    <div className="import-row">
      <RowHeader icon={<AlertTriangle size={15} color="var(--draw)" />} name={result.inputName} />
      <StatusMessage type="warning">Plusieurs équipes correspondent à ce nom. Veuillez sélectionner la bonne.</StatusMessage>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {result.alternatives.map((c) => (
          <div key={c.team.id} className="team-option">
            <CandidateInfo candidate={c} season={season} />
            <button className="btn" style={{ padding: '6px 12px' }} disabled={inRoster(c.team.id)} onClick={() => onConfirm(c)}>
              {inRoster(c.team.id) ? 'Déjà ajoutée' : 'Choisir'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Nom | Pays | Championnat | Logo d'un candidat. Le championnat est lu via
// /leagues?team= (mis en cache 30 jours côté serveur). S'il est indisponible,
// on l'indique sans rien inventer.
export function CandidateInfo({ candidate, season }) {
  const [league, setLeague] = useState(undefined); // undefined = chargement, null = indisponible
  useEffect(() => {
    let cancelled = false;
    getLeaguesForTeam(candidate.team.id, season)
      .then((resp) => {
        if (cancelled) return;
        const picked = pickDomesticLeague(resp, candidate.team.country, season);
        setLeague(picked.league ? picked.league.name : null);
      })
      .catch(() => !cancelled && setLeague(null));
    return () => {
      cancelled = true;
    };
  }, [candidate.team.id, candidate.team.country, season]);

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
      {candidate.team.logo && <img className="team-logo" src={candidate.team.logo} alt="" width={28} height={28} />}
      <span style={{ minWidth: 0 }}>
        <strong>{candidate.team.name}</strong>
        <span style={{ display: 'block', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
          {candidate.team.country || 'Pays non disponible'} · {league === undefined ? 'championnat…' : league || 'championnat non disponible'} · ID {candidate.team.id}
        </span>
      </span>
    </span>
  );
}

function RowHeader({ icon, name }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontWeight: 500 }}>
      {icon}
      <span>{name}</span>
    </div>
  );
}

import { useState } from 'react';
import { Check, AlertTriangle, X, Upload } from 'lucide-react';
import { useTeams } from '../context/TeamsContext';
import { StatusMessage } from '../components/StatusMessage';

export default function ImportTeams() {
  const { resolveTeamNames, confirmTeam, roster } = useTeams();
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
              <ImportRow key={`${r.inputName}-${i}`} result={r} onConfirm={(c) => handleConfirm(i, c)} inRoster={alreadyInRoster} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ImportRow({ result, onConfirm, inRoster }) {
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
          <span>
            Équipe trouvée : <strong>{result.best.team.name}</strong> — {result.best.team.country}
          </span>
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {result.alternatives.map((c) => (
          <button
            key={c.team.id}
            className="btn"
            style={{ padding: '6px 12px' }}
            disabled={inRoster(c.team.id)}
            onClick={() => onConfirm(c)}
          >
            {inRoster(c.team.id) ? '✓ ' : ''}{c.team.name} — {c.team.country}
          </button>
        ))}
      </div>
    </div>
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

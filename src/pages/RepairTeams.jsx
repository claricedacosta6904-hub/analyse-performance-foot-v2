import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useTeams } from '../context/TeamsContext';
import { StatusMessage, EmptyState } from '../components/StatusMessage';
import { CandidateInfo } from './ImportTeams';

// Vérifie les équipes DÉJÀ importées : repère celles qui sont féminines,
// jeunes, réserves, ou dans le mauvais pays (ex : "Naples" USA au lieu de
// Napoli, Italie), propose les bons clubs, et laisse l'utilisatrice choisir.
// Le nom qu'elle a choisi est conservé ; seuls l'ID, le pays et le logo changent.
export default function RepairTeams() {
  const navigate = useNavigate();
  const { getSuspiciousTeams, verifyRoster, repairTeam, season } = useTeams();
  const [proposals, setProposals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fixed, setFixed] = useState([]); // anciens IDs déjà corrigés

  const suspicious = getSuspiciousTeams();

  const run = async () => {
    setLoading(true);
    setProposals(await verifyRoster());
    setLoading(false);
  };

  const apply = (oldId, candidate) => {
    repairTeam(oldId, candidate);
    setFixed((prev) => [...prev, oldId]);
  };

  const applyAllCertain = () => {
    (proposals || []).forEach((p) => {
      if (p.status === 'found' && p.best && !fixed.includes(p.team.id)) apply(p.team.id, p.best);
    });
  };

  return (
    <div>
      <button className="btn" onClick={() => navigate('/equipes')} style={{ marginBottom: 16 }}>
        <ArrowLeft size={15} /> Retour aux équipes
      </button>
      <div className="page-header">
        <div>
          <h1 className="page-title">Vérifier mes équipes</h1>
          <p className="page-subtitle">Équipes féminines, jeunes, réserves ou mauvais pays : tu choisis la bonne, rien n'est changé sans ton accord.</p>
        </div>
      </div>

      {!proposals && suspicious.length === 0 && (
        <div className="card">
          <EmptyState title="Aucune équipe suspecte" description="Toutes tes équipes ont un nom et un pays cohérents." />
        </div>
      )}

      {!proposals && suspicious.length > 0 && (
        <div className="card">
          <p style={{ marginBottom: 12 }}>{suspicious.length} équipe(s) à vérifier :</p>
          <ul style={{ margin: '0 0 16px 18px' }}>
            {suspicious.map((t) => (
              <li key={t.id}>{t.name} — {t.country || 'pays inconnu'} — ID {t.id}</li>
            ))}
          </ul>
          <button className="btn btn-primary" onClick={run} disabled={loading}>
            <ShieldCheck size={16} /> {loading ? 'Recherche en cours...' : 'Chercher les bons clubs'}
          </button>
        </div>
      )}

      {proposals && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '0.95rem' }}>Propositions ({proposals.length})</h3>
            {proposals.some((p) => p.status === 'found' && !fixed.includes(p.team.id)) && (
              <button className="btn btn-primary" onClick={applyAllCertain}>Appliquer toutes les propositions sûres</button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {proposals.map((p) => (
              <div key={p.team.id} className="import-row">
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  {p.team.name} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(actuel : {p.team.country || '?'}, ID {p.team.id})</span>
                </div>
                {fixed.includes(p.team.id) ? (
                  <StatusMessage type="info">Corrigée.</StatusMessage>
                ) : p.status === 'error' ? (
                  <StatusMessage type="error">{p.error}</StatusMessage>
                ) : p.status === 'not_found' ? (
                  <StatusMessage type="warning">Aucun club masculin trouvé. Supprime cette équipe et ajoute-la à nouveau par son nom exact.</StatusMessage>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {p.status === 'ambiguous' && <StatusMessage type="warning">Plusieurs clubs possibles : choisis le bon.</StatusMessage>}
                    {(p.status === 'found' ? [p.best] : p.alternatives).map((c) => (
                      <div key={c.team.id} className="team-option">
                        <CandidateInfo candidate={c} season={season} />
                        <button className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={() => apply(p.team.id, c)}>
                          Choisir
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

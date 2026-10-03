import { useMemo } from 'react';
import { useTeams } from '../context/TeamsContext';
import { getDataStatus, STATUS_LABELS, formatUpdateTime } from '../utils/liveStatus';

export default function DataStatusBadge() {
  const { roster, teamData, lastUpdated } = useTeams();

  const status = useMemo(() => {
    if (roster.length === 0) return null;
    const statuses = roster.map((t) => getDataStatus(teamData[t.id]));
    if (statuses.includes('unavailable')) return 'unavailable';
    if (statuses.includes('needs_refresh') || statuses.includes('unknown')) return 'needs_refresh';
    return 'up_to_date';
  }, [roster, teamData]);

  if (!status) return null;

  const info = STATUS_LABELS[status];

  return (
    <div className="data-status-badge" title={info.label}>
      <span>{info.icon}</span>
      <span className="hide-mobile">DERNIÈRE MISE À JOUR : {formatUpdateTime(lastUpdated)}</span>
      <style>{`
        .data-status-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.74rem;
          color: var(--text-dim);
          font-family: var(--font-display);
          letter-spacing: 0.02em;
          padding: 8px 12px;
          border: 1px solid var(--card-border-strong);
          border-radius: 10px;
          background: var(--card);
        }
        @media (max-width: 560px) {
          .hide-mobile { display: none; }
        }
      `}</style>
    </div>
  );
}

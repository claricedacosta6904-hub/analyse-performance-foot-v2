import { AlertTriangle, Info } from 'lucide-react';

export function StatusMessage({ type = 'info', children }) {
  const Icon = type === 'error' || type === 'warning' ? AlertTriangle : Info;
  return (
    <div className={`status-message ${type}`}>
      <Icon size={16} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
      <span>{children}</span>
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <h3 style={{ fontSize: '1.05rem', marginBottom: 8, color: 'var(--text)' }}>{title}</h3>
      {description && <p style={{ marginBottom: 16 }}>{description}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ height = 16, width = '100%' }) {
  return <div className="skeleton" style={{ height, width }} />;
}

// Formate .value ou renvoie "Non disponible" jamais undefined/null/NaN à l'écran.
export function fmt(value, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Non disponible';
  return `${value}${suffix}`;
}

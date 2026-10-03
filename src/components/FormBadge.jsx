export function FormDot({ result }) {
  if (!result) return <span className="form-dot" style={{ background: 'var(--card-border-strong)' }}>–</span>;
  return <span className={`form-dot ${result}`}>{result}</span>;
}

export function FormSequence({ sequence = [] }) {
  if (sequence.length === 0) {
    return <span style={{ color: 'var(--text-faint)', fontSize: '0.82rem' }}>Non disponible</span>;
  }
  return (
    <span className="form-sequence">
      {sequence.map((r, i) => (
        <FormDot key={i} result={r} />
      ))}
    </span>
  );
}

export function ResultPill({ result }) {
  const map = {
    W: { cls: 'pill-win', label: 'Victoire' },
    D: { cls: 'pill-draw', label: 'Nul' },
    L: { cls: 'pill-loss', label: 'Défaite' },
  };
  const info = map[result] || { cls: 'pill-neutral', label: 'Non disponible' };
  return <span className={`pill ${info.cls}`}>{result || '–'}</span>;
}

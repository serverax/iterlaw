'use client';

export type AxiomPulseStatus = 'idle' | 'running' | 'done' | 'error';

export interface AxiomPulseProps {
  status: AxiomPulseStatus;
  label?: string;
}

export function AxiomPulse({ status, label = 'Axiom reasoning' }: AxiomPulseProps) {
  const isActive = status === 'running';
  return (
    <div
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        color: '#F0EDE6',
        fontSize: '0.95rem',
      }}
    >
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: '999px',
          background: status === 'error' ? '#E05555' : status === 'done' ? '#4ADE80' : '#C9A84C',
          boxShadow: isActive ? '0 0 0 6px rgba(201,168,76,0.18)' : 'none',
          opacity: isActive ? 0.75 : 1,
          transition: 'opacity 0.35s ease, box-shadow 0.35s ease',
        }}
      />
      <div>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div style={{ color: '#9A97A0', fontSize: '0.85rem' }}>
          {status === 'idle' && 'Waiting'}
          {status === 'running' && 'Working through statutes and facts…'}
          {status === 'done' && 'Complete'}
          {status === 'error' && 'Something went wrong'}
        </div>
      </div>
    </div>
  );
}

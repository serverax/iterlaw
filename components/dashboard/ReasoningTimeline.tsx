'use client';

import type { ReasoningStep } from '@/types';

export interface ReasoningTimelineProps {
  steps: ReasoningStep[];
}

export function ReasoningTimeline({ steps }: ReasoningTimelineProps) {
  return (
    <ol
      aria-label="Reasoning timeline"
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'grid',
        gap: '0.75rem',
        color: '#F0EDE6',
      }}
    >
      {steps.map((step) => (
        <li
          key={step.step}
          style={{
            borderLeft: '3px solid #C9A84C',
            paddingLeft: '0.75rem',
            background: '#1A1D26',
            borderRadius: '8px',
            padding: '0.75rem 0.75rem 0.75rem 0.9rem',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
            Step {step.step}: {step.title}
          </div>
          <div style={{ color: '#C9C6CF', marginTop: '0.35rem', whiteSpace: 'pre-wrap' }}>{step.summary}</div>
          {step.statutoryAnchor ? (
            <div style={{ color: '#9A97A0', marginTop: '0.35rem', fontSize: '0.85rem' }}>
              Anchor: {step.statutoryAnchor}
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

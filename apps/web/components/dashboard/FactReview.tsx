'use client';

import type { LegalFact } from '@/types';
import { useMemo } from 'react';

export interface FactReviewProps {
  facts: LegalFact[];
  onChange: (factId: string, userConfirmed: boolean) => void;
}

export function FactReview({ facts, onChange }: FactReviewProps) {
  const pending = useMemo(() => facts.filter((f) => !f.userConfirmed).length, [facts]);

  return (
    <section aria-label="Fact review" style={{ color: '#F0EDE6' }}>
      <header style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Fact review</h2>
        <p style={{ color: '#9A97A0', fontSize: '0.875rem' }}>
          Confirm each extracted fact before running ART. Pending: {pending}
        </p>
      </header>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem' }}>
        {facts.map((fact) => (
          <li
            key={fact.id}
            style={{
              border: '1px solid #252836',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              background: '#1A1D26',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{fact.label}</div>
                <div style={{ color: '#C9C6CF', marginTop: '0.35rem', fontSize: '0.9rem' }}>{fact.value}</div>
                {fact.sourceSpan ? (
                  <div style={{ color: '#6F6C78', marginTop: '0.35rem', fontSize: '0.8rem' }}>
                    Source: {fact.sourceSpan}
                  </div>
                ) : null}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={Boolean(fact.userConfirmed)}
                  onChange={(e) => onChange(fact.id, e.target.checked)}
                />
                Confirmed
              </label>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

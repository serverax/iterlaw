'use client';

import { useState } from 'react';
import Link from 'next/link';

const SITUATIONS = [
  { id: 'disciplinary', label: 'Disciplinary action' },
  { id: 'dismissal', label: 'Dismissal' },
  { id: 'suspension', label: 'Suspension' },
  { id: 'discrimination', label: 'Discrimination' },
  { id: 'redundancy', label: 'Redundancy' },
  { id: 'grievance', label: 'Grievance' },
];

export default function CaseStartPage() {
  const [situation, setSituation] = useState('');

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-slate-400 hover:text-amber-400">
          ← Home
        </Link>
        <h1 className="mt-4 text-3xl font-bold">What&apos;s happening?</h1>
        <p className="mt-2 text-slate-400">Choose the situation that best matches your case.</p>

        <div className="mt-8 grid gap-3">
          {SITUATIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSituation(s.id)}
              className={`rounded-lg border-2 p-4 text-left transition ${
                situation === s.id
                  ? 'border-amber-500 bg-slate-900'
                  : 'border-slate-800 bg-slate-950 hover:border-amber-500/50'
              }`}
            >
              <span className="font-semibold">{s.label}</span>
            </button>
          ))}
        </div>

        {situation ? (
          <Link
            href={`/case/assessment?situation=${situation}`}
            className="mt-8 block w-full rounded-lg bg-amber-500 py-3 text-center font-semibold text-slate-950 hover:bg-amber-400"
          >
            Continue
          </Link>
        ) : null}
      </div>
    </main>
  );
}

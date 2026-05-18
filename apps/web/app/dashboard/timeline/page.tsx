'use client';

import Link from 'next/link';

const DEMO_EVENTS = [
  { date: '2026-05-01', text: 'Received disciplinary letter' },
  { date: '2026-05-08', text: 'Requested companion for meeting' },
  { date: '2026-05-14', text: 'Hearing scheduled' },
];

export default function TimelinePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard" className="text-sm text-slate-400 hover:text-amber-400">
          ← Dashboard
        </Link>
        <h1 className="mt-4 text-3xl font-bold">Case timeline</h1>
        <p className="mt-2 text-slate-400">Demo events until case API is wired.</p>

        <ol className="mt-8 space-y-4">
          {DEMO_EVENTS.map((e, i) => (
            <li
              key={e.date}
              className="flex gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-400">
                {i + 1}
              </span>
              <div>
                <p className="font-medium">{e.text}</p>
                <p className="mt-1 text-sm text-slate-500">{e.date}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}

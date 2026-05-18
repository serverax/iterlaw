'use client';

import Link from 'next/link';

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm text-slate-400 hover:text-amber-400">
          ← Home
        </Link>
        <h1 className="mt-4 text-3xl font-bold">My case</h1>
        <p className="mt-2 text-slate-400">Anonymous pilot mode — connect APIs for live case data.</p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-500">Status</p>
            <p className="mt-2 text-2xl font-bold text-amber-400">Disciplinary</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-500">Days active</p>
            <p className="mt-2 text-2xl font-bold text-amber-400">14</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-500">Next action</p>
            <p className="mt-2 text-2xl font-bold text-amber-400">Hearing</p>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/dashboard/timeline"
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-center hover:border-amber-500/50"
          >
            View timeline
          </Link>
          <Link
            href="/dashboard/documents"
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-center hover:border-amber-500/50"
          >
            Documents
          </Link>
          <Link
            href="/answer"
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-center hover:border-amber-500/50"
          >
            Ask a question
          </Link>
          <Link
            href="/next-step"
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-center hover:border-amber-500/50"
          >
            Next steps
          </Link>
          <Link
            href="/case/start"
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-center hover:border-amber-500/50"
          >
            New case
          </Link>
          <Link
            href="/case/assessment"
            className="rounded-lg bg-amber-500 px-4 py-3 text-center font-semibold text-slate-950 hover:bg-amber-400"
          >
            Start assessment
          </Link>
        </div>
      </div>
    </main>
  );
}

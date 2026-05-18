'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function DocumentsPage() {
  const [file, setFile] = useState<File | null>(null);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard" className="text-sm text-slate-400 hover:text-amber-400">
          ← Dashboard
        </Link>
        <h1 className="mt-4 text-3xl font-bold">Documents</h1>
        <p className="mt-2 text-slate-400">Upload letters for issue-by-issue review (stub).</p>

        <label className="mt-8 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-900 p-10 hover:border-amber-500/50">
          <span className="text-sm text-slate-400">PDF or image, max 10MB</span>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="mt-4 text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {file ? (
          <p className="mt-4 text-sm text-amber-400">Selected: {file.name}</p>
        ) : null}

        <button
          type="button"
          disabled={!file}
          className="mt-6 w-full rounded-lg bg-amber-500 py-3 font-semibold text-slate-950 disabled:opacity-40"
        >
          Upload (stub)
        </button>
      </div>
    </main>
  );
}

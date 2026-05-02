'use client';

import { useAxiomEngine } from '@/hooks/useAxiomEngine';
import React, { useEffect } from 'react';

/**
 * Demo widget for POST /api/axiom/process (SSE). Uses plain CSS (no framer-motion).
 */
export function AxiomStreamWidget({
  caseId,
  onComplete,
}: {
  caseId: string;
  onComplete?: (result: Record<string, unknown>) => void;
}) {
  const { status, message, progress, result, error, processExtract, cancel } = useAxiomEngine();

  useEffect(() => {
    if (status === 'complete' && result) {
      onComplete?.(result);
    }
  }, [status, result, onComplete]);

  const sampleText =
    'I have worked for two years. Last week I raised a grievance about bullying. Yesterday I was dismissed without any process.';

  return (
    <div className="w-full max-w-xl space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
      {status === 'idle' && (
        <button
          type="button"
          onClick={() =>
            void processExtract({
              caseId,
              documentText: sampleText,
              currentState: 'intake',
            })
          }
          className="w-full rounded bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-700"
        >
          Start extraction (demo)
        </button>
      )}
      {status !== 'idle' && status !== 'complete' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">{message}</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-cyan-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-right text-xs text-slate-400">{progress}%</p>
          <button type="button" onClick={cancel} className="w-full py-1 text-xs text-red-400 hover:text-red-300">
            Cancel
          </button>
        </div>
      )}
      {status === 'complete' && result && (
        <div className="space-y-2 rounded border border-green-500/20 bg-green-500/10 p-3">
          <h4 className="font-bold text-green-400">Complete</h4>
          <pre className="max-h-32 overflow-auto rounded bg-black/50 p-2 text-xs">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
      {status === 'error' && (
        <div className="space-y-2 rounded border border-red-500/20 bg-red-500/10 p-3">
          <h4 className="font-bold text-red-400">Error</h4>
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}
    </div>
  );
}

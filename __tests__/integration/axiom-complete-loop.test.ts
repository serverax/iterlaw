jest.mock('@/lib/supabase/client', () => ({
  getServiceSupabase: jest.fn(() => null),
  saveFacts: jest.fn(async () => ({ ok: true, skipped: true })),
  saveReasoning: jest.fn(async () => ({ ok: true, skipped: true })),
  saveDocuments: jest.fn(async () => ({ ok: true, skipped: true })),
}));

import { runExtractPhase, runReasonPhase } from '@/lib/workflow/axiom-orchestrator';

describe('integration — axiom extract → reason loop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('extracts facts then reasons after confirmations', async () => {
    const narrative =
      'I have ten years service. I was placed on a performance plan in January. In March I went off sick with stress. In May I was dismissed for capability.';
    const extracted = await runExtractPhase({
      caseId: 'loop-1',
      documentText: narrative,
      currentState: 'intake',
    });

    const confirmed = extracted.facts.map((f) => ({ ...f, userConfirmed: true as const }));
    const reasoned = await runReasonPhase({
      caseId: 'loop-1',
      jurisdiction: 'england_wales',
      facts: confirmed,
      currentState: 'facts_review',
    });

    expect(reasoned.trace.jurisdiction).toBe('england_wales');
    expect(reasoned.document.title.length).toBeGreaterThan(3);
  });
});

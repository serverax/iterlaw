jest.mock('@/lib/supabase/client', () => ({
  getServiceSupabase: jest.fn(() => null),
  saveFacts: jest.fn(async () => ({ ok: true, skipped: true })),
  saveReasoning: jest.fn(async () => ({ ok: true, skipped: true })),
  saveDocuments: jest.fn(async () => ({ ok: true, skipped: true })),
}));

import * as supabaseClient from '@/lib/supabase/client';
import { runExtractPhase, runReasonPhase } from '@/lib/workflow/axiom-orchestrator';

describe('axiom-orchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseClient.saveFacts as jest.Mock).mockResolvedValue({ ok: true, skipped: true });
    (supabaseClient.saveReasoning as jest.Mock).mockResolvedValue({ ok: true, skipped: true });
    (supabaseClient.saveDocuments as jest.Mock).mockResolvedValue({ ok: true, skipped: true });
  });

  it('runs extract phase from intake', async () => {
    const text =
      'I have worked for two years. Last week I raised a grievance about bullying. Yesterday I was dismissed without any process.';
    const result = await runExtractPhase({ caseId: 'case_x', documentText: text, currentState: 'intake' });
    expect(result.nextState).toBe('facts_review');
    expect(result.facts.length).toBeGreaterThan(0);
    expect(result.extractionConfidence).toBeGreaterThan(0.5);
  });

  it('runs reason phase when facts are confirmed', async () => {
    const facts = [
      {
        id: 'f1',
        label: 'Event',
        value: 'Dismissed after raising a grievance about bullying.',
        confidence: 0.8,
        userConfirmed: true,
      },
    ];

    const result = await runReasonPhase({
      caseId: 'case_x',
      jurisdiction: 'england_wales',
      facts,
      currentState: 'facts_review',
    });

    expect(result.nextState).toBe('complete');
    expect(result.trace.steps).toHaveLength(5);
    expect(result.document.body.length).toBeGreaterThan(50);
  });

  it('rejects reasoning when facts are not confirmed', async () => {
    await expect(
      runReasonPhase({
        caseId: 'case_x',
        jurisdiction: 'england_wales',
        facts: [{ id: 'f1', label: 'x', value: 'y', confidence: 0.5, userConfirmed: false }],
        currentState: 'facts_review',
      })
    ).rejects.toThrow('userConfirmed=true');
  });

  it('fails extract phase when persistence returns an error', async () => {
    (supabaseClient.saveFacts as jest.Mock).mockResolvedValueOnce({ ok: false, error: 'db unavailable' });
    await expect(
      runExtractPhase({
        caseId: 'case_x',
        documentText:
          'I have worked for two years. Last week I raised a grievance about bullying. Yesterday I was dismissed without any process.',
        currentState: 'intake',
      })
    ).rejects.toThrow('db unavailable');
  });
});

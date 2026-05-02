import { getServiceSupabase, saveDocuments, saveFacts, saveReasoning } from '@/lib/supabase/client';
import type { AxiomTrace, DocumentDraft } from '@/types';

describe('supabase service client', () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  afterEach(() => {
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
  });

  it('returns null when credentials are missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(getServiceSupabase()).toBeNull();
  });

  it('skips persistence when supabase is not configured', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(saveFacts('c1', [{ id: 'f1', label: 'L', value: 'V', confidence: 0.5 }])).resolves.toEqual({
      ok: true,
      skipped: true,
    });

    const trace: AxiomTrace = {
      caseId: 'c1',
      steps: [{ step: 1, title: 't', summary: 's' }],
      meritScore: 50,
      jurisdiction: 'england_wales',
      generatedAt: new Date().toISOString(),
    };
    const doc: DocumentDraft = { id: 'd1', title: 't', body: 'b', format: 'plain' };

    await expect(saveReasoning('c1', trace)).resolves.toEqual({ ok: true, skipped: true });
    await expect(saveDocuments('c1', doc)).resolves.toEqual({ ok: true, skipped: true });
  });
});

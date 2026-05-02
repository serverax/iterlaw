import { extractRequestSchema } from '@/lib/agents/extraction-schema';
import { documentDraftSchema } from '@/lib/agents/document-schema';
import { reasonRequestSchema } from '@/lib/agents/reasoning-schema';

describe('axiom request schemas', () => {
  it('parses extract requests', () => {
    const body = extractRequestSchema.parse({
      caseId: 'c1',
      documentText: 'x'.repeat(25),
      currentState: 'intake',
    });
    expect(body.caseId).toBe('c1');
  });

  it('rejects short extract documents', () => {
    expect(() =>
      extractRequestSchema.parse({
        caseId: 'c1',
        documentText: 'short',
      })
    ).toThrow();
  });

  it('parses reason requests', () => {
    const body = reasonRequestSchema.parse({
      caseId: 'c1',
      jurisdiction: 'scotland',
      facts: [{ id: 'f1', label: 'L', value: 'V' }],
      currentState: 'facts_review',
    });
    expect(body.jurisdiction).toBe('scotland');
  });

  it('parses document drafts', () => {
    const doc = documentDraftSchema.parse({
      id: 'd1',
      title: 'Letter',
      body: 'Hello',
      format: 'markdown',
    });
    expect(doc.format).toBe('markdown');
  });
});

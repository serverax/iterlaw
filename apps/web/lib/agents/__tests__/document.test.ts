import { buildEmploymentLetter } from '@/lib/agents/axiom-employment/document-employment';
import { buildNeutralDraft } from '@/lib/agents/document-architect';
import { traceEmploymentLaw } from '@/lib/agents/axiom-employment/reasoning-employment';

describe('ADA — document generation', () => {
  it('builds a neutral draft from facts', () => {
    const draft = buildNeutralDraft({
      caseId: 'abc',
      facts: [{ id: 'f1', label: 'Pay', value: 'I was not paid for April.', confidence: 0.7 }],
      traceSummary: 'Summary line',
    });
    expect(draft.body).toContain('Private and confidential');
    expect(draft.body).toContain('I was not paid for April.');
    expect(draft.format).toBe('plain');
  });

  it('wraps employment letters with ADA prompt contract header', () => {
    const facts = [
      { id: 'f1', label: 'Notice', value: 'No PILON was offered.', confidence: 0.72, userConfirmed: true },
    ];
    const trace = traceEmploymentLaw('case', facts, 'england_wales');
    const doc = buildEmploymentLetter('case', facts, trace);
    expect(doc.body).toContain('<!-- ADA system contract');
    expect(doc.body).toContain('Yours sincerely');
  });
});

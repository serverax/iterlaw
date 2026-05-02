import { runAxiomPipeline } from '../runAxiomPipeline';

const goodFacts = {
  termination_date_iso: '2027-06-01',
  continuous_service_months: 18,
};

const goodConclusions = [
  {
    text: 'Position summary',
    source_type: 'GOV.UK',
    reference: 'https://www.gov.uk/dismissal',
  },
];

describe('runAxiomPipeline (AEE → ART → LVC → SEA)', () => {
  it('skips SEA when LVC not verified', () => {
    const r = runAxiomPipeline({
      extracted_facts: goodFacts,
      reasoning_output: 'Ordinary unfair dismissal definitely succeeds without more facts.',
      legal_conclusions: [{ text: 'x', source_type: 'unknown', reference: '' }],
    });
    expect(r.lvc.verified).toBe(false);
    expect(r.sea).toBeNull();
    expect(r.review_queue_status).toBe('needs_attention');
    expect(r.lvc_status).toBe('failed');
  });

  it('skips SEA when verified but confidence below 70', () => {
    const r = runAxiomPipeline({
      extracted_facts: { employer: 'X' },
      reasoning_output:
        'Dismissal and unfair dismissal qualifying period in 2026. [REQUIRES_FACT: payroll_records]',
      legal_conclusions: goodConclusions,
    });
    expect(r.lvc.verified).toBe(true);
    expect(r.lvc.confidence_score).toBeLessThan(70);
    expect(r.sea).toBeNull();
    expect(r.review_queue_status).toBe('needs_attention');
  });

  it('runs SEA when LVC verified and confidence ≥ 70', () => {
    const r = runAxiomPipeline({
      extracted_facts: goodFacts,
      reasoning_output: {
        trace:
          'Employment dismissal: unfair dismissal ordinary and automatic heads, discrimination, ACAS code fairness.',
        topicsAddressed: [
          'unfair_dismissal',
          'automatic_unfair',
          'discrimination',
          'acas_procedural',
        ],
      },
      legal_conclusions: goodConclusions,
    });
    expect(r.lvc.verified).toBe(true);
    expect(r.lvc.confidence_score).toBeGreaterThanOrEqual(70);
    expect(r.sea).not.toBeNull();
    expect(r.sea?.definitive_legal_statements_avoided).toBe(false);
    expect(r.review_queue_status).toBe('pending_review');
    expect(r.lvc_status).toBe('verified');
  });
});

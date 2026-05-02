import { lvcConfidenceBand, verifyLegalOutput } from '../legalVerificationController';

describe('LVC — verifyLegalOutput', () => {
  it('fails verification when a legal conclusion is missing source_type or reference', () => {
    const out = verifyLegalOutput({
      extracted_facts: { employer: 'X' },
      reasoning_output: 'Employment dispute regarding dismissal.',
      legal_conclusions: [{ text: 'You win', source_type: 'blog', reference: '' }],
    });
    expect(out.verified).toBe(false);
    expect(out.errors.some((e) => e.includes('source_type'))).toBe(true);
    expect(out.errors.some((e) => e.includes('reference'))).toBe(true);
    expect(out.requires_review).toBe(true);
    expect(lvcConfidenceBand(out.confidence_score)).toBe('unsafe');
  });

  it('flags inconsistent ordinary unfair dismissal vs Jan 2027 qualifying period', () => {
    const out = verifyLegalOutput({
      extracted_facts: {
        termination_date_iso: '2027-02-01',
        continuous_service_months: 5,
      },
      reasoning_output:
        'Ordinary unfair dismissal: the employee has ordinary unfair dismissal protection and may bring a claim.',
      legal_conclusions: [
        {
          text: 'Ordinary UD available',
          source_type: 'legislation.gov.uk',
          reference: 'ERA 1996 s.94',
        },
      ],
    });
    expect(out.verified).toBe(false);
    expect(out.errors.some((e) => e.includes('qualifying period'))).toBe(true);
  });

  it('populates missing_evidence when termination date absent for dismissal analysis', () => {
    const out = verifyLegalOutput({
      extracted_facts: { employer: 'Co' },
      reasoning_output: 'Qualifying period for unfair dismissal depends on termination date in 2026.',
      legal_conclusions: [
        {
          text: 'Check qualifying period',
          source_type: 'GOV.UK',
          reference: 'https://www.gov.uk/dismissal',
        },
      ],
    });
    expect(out.missing_evidence.some((m) => m.toLowerCase().includes('termination'))).toBe(true);
    expect(out.requires_review).toBe(true);
  });

  it('passes with valid sources, service, termination, and employment coverage hints', () => {
    const out = verifyLegalOutput({
      extracted_facts: {
        termination_date_iso: '2027-06-01',
        continuous_service_months: 12,
      },
      reasoning_output: {
        trace:
          'Unfair dismissal: ordinary unfair dismissal qualifying service. Automatic unfair dismissal heads noted. Discrimination under Equality Act. ACAS Code on disciplinary fairness.',
        topicsAddressed: [
          'unfair_dismissal',
          'automatic_unfair',
          'discrimination',
          'acas_procedural',
        ],
      },
      legal_conclusions: [
        {
          text: 'Summary',
          source_type: 'legislation',
          reference: 'https://www.legislation.gov.uk/ukpga/1996/18/section/94',
        },
      ],
    });
    expect(out.verified).toBe(true);
    expect(out.errors).toHaveLength(0);
  });
});

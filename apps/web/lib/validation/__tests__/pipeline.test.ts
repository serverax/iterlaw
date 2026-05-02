import type { GovAPIResult } from '@/lib/gov-apis/types';
import { validateAndFormatAnswer } from '../pipeline';

describe('validateAndFormatAnswer', () => {
  it('returns failure when Gov API results are empty', async () => {
    const result = await validateAndFormatAnswer('any question', []);
    expect(result.passed).toBe(false);
    expect(result.escalate).toBe(true);
    expect(result.errors[0]).toContain('No Government API results');
  });

  it('formats and validates the top Gov API result', async () => {
    const gov: GovAPIResult[] = [
      {
        title: 'Redundancy',
        content: 'Employment Rights Act 1996 Section 135. Statutory redundancy pay may be payable.',
        url: 'https://www.gov.uk/redundancy-your-rights',
        source: 'GOV_UK',
        relevanceScore: 0.9,
        jurisdiction: 'england_wales',
        citeAs: 'Section 135',
      },
    ];

    const result = await validateAndFormatAnswer('Am I entitled to redundancy pay?', gov, {
      jurisdiction: 'england_wales',
      situation_type: 'redundancy',
    });

    expect(result.passed).toBe(true);
    expect(result.formatted?.law_section).toContain('Section 135');
    expect(result.escalate).toBe(false);
  });

  it('maps GOV_UK to GOV_API for validation rules', async () => {
    const gov: GovAPIResult[] = [
      {
        title: 'Dismissal',
        content: 'Employment Rights Act 1996 Section 94.',
        url: 'https://www.gov.uk/unfair-dismissal',
        source: 'GOV_UK',
        relevanceScore: 0.95,
        jurisdiction: 'england_wales',
        citeAs: 'Section 94',
      },
    ];
    const result = await validateAndFormatAnswer('unfair dismissal', gov);
    expect(result.formatted?.source_type).toBe('GOV_API');
  });
});

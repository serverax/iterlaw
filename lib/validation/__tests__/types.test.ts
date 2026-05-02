import type { GovAPIResult } from '@/lib/gov-apis/types';
import { govResultToAnswerSource } from '../types';

describe('govResultToAnswerSource', () => {
  it.each([
    ['GOV_UK', 'GOV_API'],
    ['LEGISLATION', 'LEGISLATION'],
    ['CASELAW', 'CASELAW'],
    ['DATA_GOV', 'GOV_API'],
    ['COMPANIES_HOUSE', 'GOV_API'],
  ] as const)('maps %s → %s', (from, to) => {
    const gov: GovAPIResult = {
      title: 't',
      content: 'c',
      url: 'https://example.com',
      source: from,
      relevanceScore: 0.5,
      jurisdiction: 'england_wales',
      citeAs: 'cite',
    };
    expect(govResultToAnswerSource(gov).source).toBe(to);
  });
});

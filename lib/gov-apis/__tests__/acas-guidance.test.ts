jest.mock('@/lib/gov-apis/wrappers', () => ({
  queryGovUKAPI: jest.fn(),
}));

import { queryAcasGuidance } from '@/lib/gov-apis/acas-guidance';
import { queryGovUKAPI } from '@/lib/gov-apis/wrappers';

describe('queryAcasGuidance', () => {
  it('prefers ACAS-tagged results when present', async () => {
    (queryGovUKAPI as jest.Mock).mockResolvedValue([
      {
        title: 'Generic page',
        content: 'x',
        url: 'https://www.gov.uk/generic',
        source: 'GOV_UK',
        relevanceScore: 0.9,
        jurisdiction: 'england_wales',
        citeAs: '',
      },
      {
        title: 'ACAS guidance',
        content: 'Early conciliation',
        url: 'https://www.acas.org.uk/example',
        source: 'GOV_UK',
        relevanceScore: 0.5,
        jurisdiction: 'england_wales',
        citeAs: '',
      },
    ]);
    const rows = await queryAcasGuidance('notice');
    expect(rows[0]?.url).toContain('acas.org.uk');
  });
});

import axios from 'axios';
import {
  queryCompaniesHouseAPI,
  queryDataGovAPI,
  queryFindCaseLawAPI,
  queryGovUKAPI,
  queryLegislationAPI,
} from '../wrappers';

jest.mock('axios', () => {
  const create = jest.fn();
  return { __esModule: true, default: { create } };
});

const mockedAxios = axios as unknown as { create: jest.Mock };

function mockClient(getImpl: jest.Mock, postImpl?: jest.Mock) {
  const instance = {
    get: getImpl,
    post: postImpl ?? jest.fn(),
  };
  mockedAxios.create.mockReturnValue(instance as never);
  return instance;
}

beforeEach(() => {
  mockedAxios.create.mockReset();
  process.env.GOV_API_RETRY_COUNT = '1';
});

describe('queryGovUKAPI', () => {
  it('retries once on transient failure then succeeds', async () => {
    process.env.GOV_API_RETRY_COUNT = '1';
    const get = jest
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({
        data: { results: [{ title: 'T', link: '/t', description: 'D' }] },
      });
    mockClient(get);
    const rows = await queryGovUKAPI('redundancy pay');
    expect(rows).toHaveLength(1);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('maps GOV.UK search results', async () => {
    const get = jest.fn().mockResolvedValue({
      data: {
        results: [
          { title: 'Redundancy', link: '/redundancy-your-rights', description: 'Your rights' },
        ],
      },
    });
    mockClient(get);
    const rows = await queryGovUKAPI('What is statutory redundancy pay?');
    expect(rows[0]?.url).toBe('https://www.gov.uk/redundancy-your-rights');
    expect(rows[0]?.source).toBe('GOV_UK');
    expect(get).toHaveBeenCalled();
  });

  it('returns empty array on HTTP error', async () => {
    const get = jest.fn().mockRejectedValue(new Error('network'));
    mockClient(get);
    const rows = await queryGovUKAPI('any');
    expect(rows).toEqual([]);
  });
});

describe('queryLegislationAPI', () => {
  it('returns a legislation search navigational result', async () => {
    const get = jest.fn().mockResolvedValue({ data: '<html>employment</html>' });
    mockClient(get);
    const rows = await queryLegislationAPI('unfair dismissal', 'scotland');
    expect(rows[0]?.source).toBe('LEGISLATION');
    expect(rows[0]?.jurisdiction).toBe('scotland');
    expect(rows[0]?.url).toContain('legislation.gov.uk');
  });
});

describe('queryFindCaseLawAPI', () => {
  it('returns a case law search navigational result', async () => {
    const get = jest.fn().mockResolvedValue({ data: '<html>judgment</html>' });
    mockClient(get);
    const rows = await queryFindCaseLawAPI('tribunal time limit');
    expect(rows[0]?.source).toBe('CASELAW');
    expect(rows[0]?.url).toContain('nationalarchives.gov.uk');
  });
});

describe('queryDataGovAPI', () => {
  it('maps CKAN package_search results', async () => {
    const post = jest.fn().mockResolvedValue({
      data: {
        result: {
          results: [
            { title: 'Dataset A', notes: 'Notes', name: 'dataset-a' },
          ],
        },
      },
    });
    mockClient(jest.fn(), post);
    const rows = await queryDataGovAPI('employment statistics');
    expect(rows[0]?.url).toContain('data.gov.uk/dataset/dataset-a');
    expect(rows[0]?.source).toBe('DATA_GOV');
  });
});

describe('queryCompaniesHouseAPI', () => {
  const OLD = process.env.COMPANIES_HOUSE_API_KEY;

  afterEach(() => {
    process.env.COMPANIES_HOUSE_API_KEY = OLD;
  });

  it('returns empty when API key missing', async () => {
    delete process.env.COMPANIES_HOUSE_API_KEY;
    const rows = await queryCompaniesHouseAPI('Acme');
    expect(rows).toEqual([]);
  });

  it('maps company search items', async () => {
    process.env.COMPANIES_HOUSE_API_KEY = 'test-key';
    const get = jest.fn().mockResolvedValue({
      data: {
        items: [
          {
            title: 'ACME LTD',
            company_number: '12345678',
            snippet: 'Active company',
          },
        ],
      },
    });
    mockClient(get);
    const rows = await queryCompaniesHouseAPI('Acme');
    expect(rows[0]?.url).toContain('find-and-update.company-information.service.gov.uk/company/12345678');
    expect(rows[0]?.source).toBe('COMPANIES_HOUSE');
  });
});

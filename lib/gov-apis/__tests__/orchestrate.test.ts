import type { GovAPIResult } from '../types';
import { queryAllGovAPIs } from '../orchestrate';

jest.mock('../wrappers', () => ({
  queryGovUKAPI: jest.fn(),
  queryLegislationAPI: jest.fn(),
  queryFindCaseLawAPI: jest.fn(),
  queryDataGovAPI: jest.fn(),
  queryCompaniesHouseAPI: jest.fn(),
}));

import {
  queryCompaniesHouseAPI,
  queryDataGovAPI,
  queryFindCaseLawAPI,
  queryGovUKAPI,
  queryLegislationAPI,
} from '../wrappers';

const govUk = jest.mocked(queryGovUKAPI);
const legislation = jest.mocked(queryLegislationAPI);
const caseLaw = jest.mocked(queryFindCaseLawAPI);
const dataGov = jest.mocked(queryDataGovAPI);
const companies = jest.mocked(queryCompaniesHouseAPI);

function result(partial: Partial<GovAPIResult>): GovAPIResult {
  return {
    title: partial.title ?? 't',
    content: partial.content ?? 'c',
    url: partial.url ?? 'https://example.com',
    source: partial.source ?? 'GOV_UK',
    relevanceScore: partial.relevanceScore ?? 0.5,
    jurisdiction: partial.jurisdiction ?? 'england_wales',
    citeAs: partial.citeAs ?? 'cite',
  };
}

describe('queryAllGovAPIs', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.GOV_API_TIMEOUT_MS = '4000';
  });

  it('merges, dedupes by URL, and sorts by relevance descending', async () => {
    govUk.mockResolvedValue([
      result({ url: 'https://www.gov.uk/a', relevanceScore: 0.4, title: 'A' }),
      result({ url: 'https://www.gov.uk/b', relevanceScore: 0.9, title: 'B' }),
    ]);
    legislation.mockResolvedValue([
      result({
        url: 'https://www.gov.uk/a',
        relevanceScore: 0.99,
        source: 'LEGISLATION',
        title: 'dup',
      }),
    ]);
    caseLaw.mockResolvedValue([
      result({
        url: 'https://caselaw.example/j',
        relevanceScore: 0.2,
        source: 'CASELAW',
      }),
    ]);
    dataGov.mockResolvedValue([]);
    companies.mockResolvedValue([]);

    const { results } = await queryAllGovAPIs('redundancy unfair dismissal', 'england_wales');
    expect(results[0]?.relevanceScore).toBeGreaterThanOrEqual(results[1]?.relevanceScore ?? 0);
    const urls = results.map((r) => r.url);
    expect(urls.filter((u) => u === 'https://www.gov.uk/a').length).toBe(1);
    expect(results.length).toBeLessThanOrEqual(10);
  });

  it('continues when one API rejects (safeGovCall swallows thrown errors)', async () => {
    govUk.mockRejectedValue(new Error('boom'));
    legislation.mockResolvedValue([
      result({ url: 'https://legislation.uk/x', source: 'LEGISLATION', relevanceScore: 0.7 }),
    ]);
    caseLaw.mockResolvedValue([]);
    dataGov.mockResolvedValue([]);
    companies.mockResolvedValue([]);

    const { results } = await queryAllGovAPIs('notice period', 'england_wales');
    expect(results.some((r) => r.url === 'https://legislation.uk/x')).toBe(true);
  });

  it('respects per-source budget via GOV_API_TIMEOUT_MS', async () => {
    process.env.GOV_API_TIMEOUT_MS = '50';
    govUk.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([result({ url: 'https://slow' })]), 200);
        })
    );
    legislation.mockResolvedValue([]);
    caseLaw.mockResolvedValue([]);
    dataGov.mockResolvedValue([]);
    companies.mockResolvedValue([]);

    const { results, metadata } = await queryAllGovAPIs('minimum wage', 'england_wales');
    expect(metadata.queryMs).toBeLessThan(400);
    expect(results.find((r) => r.url === 'https://slow')).toBeUndefined();
  });

  it('calls Companies House when companyName provided', async () => {
    govUk.mockResolvedValue([]);
    legislation.mockResolvedValue([]);
    caseLaw.mockResolvedValue([]);
    dataGov.mockResolvedValue([]);
    companies.mockResolvedValue([
      result({
        url: 'https://find-and-update.company-information.service.gov.uk/company/00000000',
        source: 'COMPANIES_HOUSE',
        relevanceScore: 0.6,
      }),
    ]);

    await queryAllGovAPIs('hello', 'england_wales', 'Acme Ltd');
    expect(companies).toHaveBeenCalledWith('Acme Ltd');
  });
});

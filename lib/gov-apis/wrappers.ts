import type { GovAPIResult, GovAPISource } from './types';
import { calculateRelevance, extractKeywords } from './helpers';
import { createTimeoutClient, withRetry } from './http';

const PER_API_TIMEOUT_MS = 3000;

function empty(source: GovAPISource, message: string): GovAPIResult[] {
  console.warn(`[gov-apis:${source}] ${message}`);
  return [];
}

/** GOV.UK search (JSON) — primary guidance pages */
export async function queryGovUKAPI(question: string): Promise<GovAPIResult[]> {
  const client = createTimeoutClient(PER_API_TIMEOUT_MS);
  const q = extractKeywords(question).slice(0, 8).join(' ') || question.slice(0, 120);
  try {
    return await withRetry(async () => {
      const url = `https://www.gov.uk/api/search.json`;
      const { data } = await client.get(url, {
        params: { q, count: 10, fields: 'title,link,description' },
      });
      const rows = Array.isArray(data?.results) ? data.results : [];
      const out: GovAPIResult[] = [];
      for (const row of rows) {
        const link = typeof row?.link === 'string' ? row.link : '';
        const title = typeof row?.title === 'string' ? row.title : 'GOV.UK result';
        const description =
          typeof row?.description === 'string' ? row.description : '';
        const fullUrl = link.startsWith('http') ? link : `https://www.gov.uk${link}`;
        const body = `${title}\n\n${description}`.trim();
        const relevance = Math.max(
          calculateRelevance(question, body),
          0.15
        );
        out.push({
          title,
          content: description || title,
          url: fullUrl,
          source: 'GOV_UK',
          relevanceScore: relevance,
          jurisdiction: 'england_wales',
          citeAs: title,
        });
      }
      return out;
    });
  } catch (e) {
    return empty('GOV_UK', e instanceof Error ? e.message : 'request failed');
  }
}

/** legislation.gov.uk — navigational + keyword relevance (HTML search; safe fallback) */
export async function queryLegislationAPI(
  question: string,
  jurisdiction: string
): Promise<GovAPIResult[]> {
  const client = createTimeoutClient(PER_API_TIMEOUT_MS);
  const q = extractKeywords(question).slice(0, 12).join(' ') || question.slice(0, 120);
  try {
    return await withRetry(async () => {
      const searchUrl = `https://www.legislation.gov.uk/search?q=${encodeURIComponent(q)}`;
      const { data } = await client.get<string>(searchUrl, {
        responseType: 'text',
        headers: { Accept: 'text/html' },
        validateStatus: (s) => s >= 200 && s < 500,
      });
      const text = typeof data === 'string' ? data : '';
      const relevance = Math.max(calculateRelevance(question, text), 0.12);
      return [
        {
          title: 'Legislation.gov.uk search',
          content:
            'Official revised UK legislation. Open the search results and navigate to the relevant Act or SI for authoritative wording.',
          url: searchUrl,
          source: 'LEGISLATION',
          relevanceScore: relevance,
          jurisdiction,
          citeAs: 'Legislation.gov.uk (search)',
        },
      ];
    });
  } catch (e) {
    return empty('LEGISLATION', e instanceof Error ? e.message : 'request failed');
  }
}

/** Find Case Law (National Archives) — search entry point */
export async function queryFindCaseLawAPI(question: string): Promise<GovAPIResult[]> {
  const client = createTimeoutClient(PER_API_TIMEOUT_MS);
  const q = extractKeywords(question).slice(0, 12).join(' ') || question.slice(0, 120);
  try {
    return await withRetry(async () => {
      const searchUrl = `https://caselaw.nationalarchives.gov.uk/judgments/search?query=${encodeURIComponent(q)}`;
      const { data } = await client.get<string>(searchUrl, {
        responseType: 'text',
        headers: { Accept: 'text/html' },
        validateStatus: (s) => s >= 200 && s < 500,
      });
      const text = typeof data === 'string' ? data : '';
      const relevance = Math.max(calculateRelevance(question, text), 0.1);
      return [
        {
          title: 'Find Case Law (National Archives)',
          content:
            'Official employment and civil judgments. Use the search results to locate neutral citations and full text.',
          url: searchUrl,
          source: 'CASELAW',
          relevanceScore: relevance,
          jurisdiction: 'england_wales',
          citeAs: 'Find Case Law (search)',
        },
      ];
    });
  } catch (e) {
    return empty('CASELAW', e instanceof Error ? e.message : 'request failed');
  }
}

/** data.gov.uk CKAN API — datasets and reference material */
export async function queryDataGovAPI(question: string): Promise<GovAPIResult[]> {
  const client = createTimeoutClient(PER_API_TIMEOUT_MS);
  const q = extractKeywords(question).slice(0, 12).join(' ') || question.slice(0, 120);
  try {
    return await withRetry(async () => {
      const url = 'https://data.gov.uk/api/3/action/package_search';
      const { data } = await client.post(url, { q, rows: 10 });
      const results = data?.result?.results;
      if (!Array.isArray(results)) return [];
      const out: GovAPIResult[] = [];
      for (const pkg of results) {
        const title = typeof pkg?.title === 'string' ? pkg.title : 'Dataset';
        const notes = typeof pkg?.notes === 'string' ? pkg.notes : '';
        const name = typeof pkg?.name === 'string' ? pkg.name : '';
        const datasetUrl = name ? `https://data.gov.uk/dataset/${name}` : 'https://data.gov.uk/';
        const body = `${title}\n\n${notes}`.trim();
        out.push({
          title,
          content: notes || title,
          url: datasetUrl,
          source: 'DATA_GOV',
          relevanceScore: Math.max(calculateRelevance(question, body), 0.1),
          jurisdiction: 'england_wales',
          citeAs: title,
        });
      }
      return out;
    });
  } catch (e) {
    return empty('DATA_GOV', e instanceof Error ? e.message : 'request failed');
  }
}

/** Companies House public API — company search */
export async function queryCompaniesHouseAPI(companyName: string): Promise<GovAPIResult[]> {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!companyName?.trim()) return [];
  if (!key) {
    return empty('COMPANIES_HOUSE', 'COMPANIES_HOUSE_API_KEY not set');
  }
  const client = createTimeoutClient(PER_API_TIMEOUT_MS);
  try {
    return await withRetry(async () => {
      const url = 'https://api.company-information.service.gov.uk/search/companies';
      const { data } = await client.get(url, {
        params: { q: companyName },
        auth: { username: key, password: '' },
      });
      const items = Array.isArray(data?.items) ? data.items : [];
      const out: GovAPIResult[] = [];
      for (const item of items.slice(0, 10)) {
        const title = typeof item?.title === 'string' ? item.title : 'Company';
        const number = typeof item?.company_number === 'string' ? item.company_number : '';
        const snippet =
          typeof item?.snippet === 'string'
            ? item.snippet
            : typeof item?.description === 'string'
              ? item.description
              : '';
        const uiUrl = number
          ? `https://find-and-update.company-information.service.gov.uk/company/${number}`
          : 'https://www.gov.uk/government/organisations/companies-house';
        const body = `${title}\n${snippet}`.trim();
        out.push({
          title,
          content: snippet || title,
          url: uiUrl,
          source: 'COMPANIES_HOUSE',
          relevanceScore: Math.max(calculateRelevance(companyName, body), 0.12),
          jurisdiction: 'england_wales',
          citeAs: `Companies House — ${title}`,
        });
      }
      return out;
    });
  } catch (e) {
    return empty('COMPANIES_HOUSE', e instanceof Error ? e.message : 'request failed');
  }
}

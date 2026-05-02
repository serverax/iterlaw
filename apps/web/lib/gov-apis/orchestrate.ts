import type { GovAPIResult, GovOrchestrationMetadata, GovOrchestrationResponse } from './types';
import {
  queryCompaniesHouseAPI,
  queryDataGovAPI,
  queryFindCaseLawAPI,
  queryGovUKAPI,
  queryLegislationAPI,
} from './wrappers';
import { extractCompanyName } from './helpers';

function dedupeByUrl(results: GovAPIResult[]): GovAPIResult[] {
  const seen = new Set<string>();
  const out: GovAPIResult[] = [];
  for (const r of results) {
    const key = r.url.split('#')[0]?.toLowerCase() ?? '';
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function emptyCounts(): GovOrchestrationMetadata['apiSuccessCounts'] {
  return {
    GOV_UK: 0,
    LEGISLATION: 0,
    CASELAW: 0,
    DATA_GOV: 0,
    COMPANIES_HOUSE: 0,
  };
}

function withBudget(promise: Promise<GovAPIResult[]>, budgetMs: number): Promise<GovAPIResult[]> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve([]), budgetMs);
    promise
      .then((rows) => {
        clearTimeout(timer);
        resolve(rows);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve([]);
      });
  });
}

async function safeGovCall(promise: Promise<GovAPIResult[]>): Promise<GovAPIResult[]> {
  try {
    return await promise;
  } catch {
    return [];
  }
}

export async function queryAllGovAPIs(
  question: string,
  jurisdiction: string,
  companyName?: string
): Promise<GovOrchestrationResponse> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const budgetMs = Number(process.env.GOV_API_TIMEOUT_MS ?? 4000);
  const errors: GovOrchestrationMetadata['errors'] = [];
  const apiSuccessCounts = emptyCounts();

  const company = companyName?.trim() || extractCompanyName(question);

  const [govUk, legislation, caseLaw, dataGov, companiesHouse] = await Promise.all([
    withBudget(safeGovCall(queryGovUKAPI(question)), budgetMs),
    withBudget(safeGovCall(queryLegislationAPI(question, jurisdiction)), budgetMs),
    withBudget(safeGovCall(queryFindCaseLawAPI(question)), budgetMs),
    withBudget(safeGovCall(queryDataGovAPI(question)), budgetMs),
    company
      ? withBudget(safeGovCall(queryCompaniesHouseAPI(company)), budgetMs)
      : Promise.resolve([] as GovAPIResult[]),
  ]);

  const buckets = [
    { source: 'GOV_UK' as const, rows: govUk },
    { source: 'LEGISLATION' as const, rows: legislation },
    { source: 'CASELAW' as const, rows: caseLaw },
    { source: 'DATA_GOV' as const, rows: dataGov },
    { source: 'COMPANIES_HOUSE' as const, rows: companiesHouse },
  ];

  const merged: GovAPIResult[] = [];
  for (const b of buckets) {
    if (b.rows.length > 0) {
      apiSuccessCounts[b.source] = b.rows.length;
    }
    merged.push(...b.rows);
  }

  const deduped = dedupeByUrl(merged);
  deduped.sort((a, b) => b.relevanceScore - a.relevanceScore);
  const results = deduped.slice(0, 10);

  const finishedAt = new Date().toISOString();
  const queryMs = Date.now() - t0;

  return {
    results,
    metadata: {
      startedAt,
      finishedAt,
      queryMs,
      apiSuccessCounts,
      errors,
    },
  };
}

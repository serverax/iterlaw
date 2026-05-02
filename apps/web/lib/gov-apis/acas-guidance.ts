import type { GovAPIResult } from '@/lib/gov-apis/types';
import { queryGovUKAPI } from '@/lib/gov-apis/wrappers';

/**
 * ACAS-focused GOV.UK layer (free). Surfaces ACAS pages when present; otherwise returns top guidance rows.
 */
export async function queryAcasGuidance(question: string): Promise<GovAPIResult[]> {
  const rows = await queryGovUKAPI(`ACAS ${question}`);
  const acas = rows.filter(
    (r) =>
      r.url.toLowerCase().includes('acas.org.uk') ||
      r.title.toLowerCase().includes('acas') ||
      r.content.toLowerCase().includes('acas')
  );
  if (acas.length > 0) return acas.slice(0, 8);
  return rows.slice(0, 5);
}

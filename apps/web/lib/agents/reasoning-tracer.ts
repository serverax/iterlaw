import type { AxiomTrace, LegalFact } from '@/types';
import { traceEmploymentLaw } from '@/lib/agents/axiom-employment/reasoning-employment';

/**
 * ART — thin wrapper delegating to domain-specific employment implementation.
 */
export function buildAxiomTrace(
  caseId: string,
  facts: LegalFact[],
  jurisdiction: AxiomTrace['jurisdiction'] = 'england_wales'
): AxiomTrace {
  return traceEmploymentLaw(caseId, facts, jurisdiction);
}

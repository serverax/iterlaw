import type { AxiomTrace, DocumentDraft, LegalFact } from '@/types';
import { buildNeutralDraft } from '@/lib/agents/document-architect';
import { ADA_EMPLOYMENT_LETTER_SYSTEM_PROMPT } from '@/lib/prompts/ada-employment-letter';

function traceSummary(trace: AxiomTrace): string {
  return trace.steps.map((s) => `${s.step}. ${s.title}: ${s.summary}`).join('\n');
}

/**
 * ADA — employment document path (adds ADA prompt contract as header comment in output).
 */
export function buildEmploymentLetter(caseId: string, facts: LegalFact[], trace: AxiomTrace): DocumentDraft {
  const draft = buildNeutralDraft({
    caseId,
    title: 'Employer / HR correspondence (employment)',
    facts,
    traceSummary: traceSummary(trace),
  });

  const header = `<!-- ADA system contract (informational; not legal advice)\n${ADA_EMPLOYMENT_LETTER_SYSTEM_PROMPT.trim()}\n-->\n\n`;

  return {
    ...draft,
    body: header + draft.body,
  };
}

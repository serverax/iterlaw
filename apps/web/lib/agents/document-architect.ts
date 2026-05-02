import type { DocumentDraft, LegalFact } from '@/types';

export interface DraftParams {
  caseId: string;
  title?: string;
  facts: LegalFact[];
  traceSummary: string;
}

/**
 * ADA — Axiom Document Architect (template builder, informational).
 */
export function buildNeutralDraft(params: DraftParams): DocumentDraft {
  const title = params.title ?? 'Employment correspondence (draft)';
  const factBlock = params.facts
    .map((f, i) => `${i + 1}. ${f.label}: ${f.value}`)
    .join('\n\n');

  const body = [
    'Private and confidential',
    '',
    'Dear [Recipient name]',
    '',
    'Re: Workplace matter — factual chronology (draft for review)',
    '',
    'I am writing to set out the matters I consider relevant. This draft is for accuracy checking only.',
    '',
    'Chronology and key points',
    factBlock,
    '',
    'Reasoning summary (informational)',
    params.traceSummary,
    '',
    'Next steps I am considering (non-exhaustive)',
    '- Review internal policies and relevant correspondence.',
    '- Confirm dates and names where marked [to be completed].',
    '- Consider ACAS guidance and early conciliation where appropriate.',
    '',
    'Yours sincerely',
    '',
    '[Signature]',
    '[Date]',
  ].join('\n');

  return {
    id: `doc_${params.caseId}_draft`,
    title,
    body,
    format: 'plain',
  };
}

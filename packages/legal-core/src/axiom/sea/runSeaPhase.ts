/**
 * SEA — Safe Enforcement Assistant (backend slice).
 * Receives LVC output; must hedge when confidence is below threshold.
 */

import type { VerifyLegalOutput } from '../lvc/legalVerificationController';

export type SeaPhaseInput = {
  verified_output: unknown;
  warnings: string[];
  missing_evidence: string[];
  confidence_score: number;
  /** Original legal conclusions / reasoning snapshot for drafting context */
  context?: { legal_conclusions?: unknown[]; reasoning_summary?: string };
};

export type SeaPhaseResult = {
  drafts: string[];
  uncertainty_notes: string[];
  definitive_legal_statements_avoided: boolean;
  request_missing_information: string[];
};

const CONFIDENT_THRESHOLD = 70;

/**
 * Produces draft, user-review-oriented copy. When confidence < 70, avoids definitive legal conclusions.
 */
export function runSeaPhase(input: SeaPhaseInput): SeaPhaseResult {
  const lowConfidence = input.confidence_score < CONFIDENT_THRESHOLD;
  const uncertainty_notes: string[] = [];
  const request_missing_information = [...input.missing_evidence];

  if (lowConfidence) {
    uncertainty_notes.push(
      `Legal verification confidence is ${input.confidence_score}/100 (below ${CONFIDENT_THRESHOLD}). Wording is intentionally cautious and non-definitive.`
    );
  }
  for (const w of input.warnings) {
    uncertainty_notes.push(`Review note: ${w}`);
  }

  const drafts: string[] = [];
  if (lowConfidence) {
    drafts.push(
      '**Draft (non-definitive)** — The situation may depend on facts and evidence not yet confirmed. ' +
        'Consider gathering the items listed under “information to obtain” before relying on any next step. ' +
        'This is not legal advice; a qualified adviser should review your position.'
    );
  } else {
    drafts.push(
      '**Draft for user review** — Next practical steps are suggested below. Outcomes are not guaranteed; verify dates, sources, and workplace documents.'
    );
  }

  if (input.missing_evidence.length > 0) {
    drafts.push(
      '**Information to obtain**\n' +
        input.missing_evidence.map((m) => `- ${m}`).join('\n')
    );
  }

  if (input.context?.reasoning_summary && !lowConfidence) {
    drafts.push(`**Context (from verified reasoning)**\n${input.context.reasoning_summary}`);
  }

  return {
    drafts,
    uncertainty_notes,
    definitive_legal_statements_avoided: lowConfidence,
    request_missing_information,
  };
}

export function buildSeaInputFromLvc(
  lvc: VerifyLegalOutput,
  verifiedPayload: unknown,
  ctx?: SeaPhaseInput['context']
): SeaPhaseInput {
  return {
    verified_output: verifiedPayload,
    warnings: lvc.warnings,
    missing_evidence: lvc.missing_evidence,
    confidence_score: lvc.confidence_score,
    context: ctx,
  };
}

export { CONFIDENT_THRESHOLD };

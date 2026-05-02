/**
 * Backend axiom pipeline: AEE → ART → LVC → SEA.
 * AEE/ART are treated as upstream inputs (produced elsewhere); this module wires LVC + SEA only.
 */

import { verifyLegalOutput, type VerifyLegalInput, type VerifyLegalOutput } from '../lvc/legalVerificationController';
import { buildSeaInputFromLvc, runSeaPhase, type SeaPhaseResult } from '../sea/runSeaPhase';

/** Upstream AEE result (opaque facts object). */
export type AeePhaseOutput = {
  extracted_facts: Record<string, unknown>;
};

/** Upstream ART result (reasoning trace + structured conclusions). */
export type ArtPhaseOutput = {
  reasoning_output: string | Record<string, unknown>;
  legal_conclusions: Array<Record<string, unknown>>;
};

export type AxiomPipelineInput = AeePhaseOutput & ArtPhaseOutput;

export type AxiomPipelineResult = {
  aee: AeePhaseOutput;
  art: ArtPhaseOutput;
  lvc: VerifyLegalOutput;
  /** Present only when LVC verified and confidence ≥ 70 */
  sea: SeaPhaseResult | null;
  /** When LVC fails or SEA skipped, enqueue review_queue with this workflow status */
  review_queue_status: 'pending_review' | 'needs_attention';
  lvc_status: 'verified' | 'failed' | 'needs_attention';
};

/**
 * Runs LVC after ART. SEA runs only when `lvc.verified` and confidence ≥ 70.
 * Otherwise SEA is skipped (no definitive downstream drafting from unverified chains).
 */
export function runAxiomPipeline(input: AxiomPipelineInput): AxiomPipelineResult {
  const lvcInput: VerifyLegalInput = {
    extracted_facts: input.extracted_facts,
    reasoning_output: input.reasoning_output,
    legal_conclusions: input.legal_conclusions,
  };

  const lvc = verifyLegalOutput(lvcInput);

  const seaAllowed = lvc.verified && lvc.confidence_score >= 70;
  const sea: SeaPhaseResult | null = seaAllowed
    ? runSeaPhase(
        buildSeaInputFromLvc(
          lvc,
          {
            extracted_facts: input.extracted_facts,
            reasoning_output: input.reasoning_output,
            legal_conclusions: input.legal_conclusions,
          },
          {
            legal_conclusions: input.legal_conclusions,
            reasoning_summary:
              typeof input.reasoning_output === 'string'
                ? input.reasoning_output
                : JSON.stringify(input.reasoning_output).slice(0, 4000),
          }
        )
      )
    : null;

  const lvc_status: AxiomPipelineResult['lvc_status'] = lvc.verified
    ? seaAllowed
      ? 'verified'
      : 'needs_attention'
    : 'failed';

  const review_queue_status: AxiomPipelineResult['review_queue_status'] =
    lvc.verified && seaAllowed ? 'pending_review' : 'needs_attention';

  return {
    aee: { extracted_facts: input.extracted_facts },
    art: {
      reasoning_output: input.reasoning_output,
      legal_conclusions: input.legal_conclusions,
    },
    lvc,
    sea,
    review_queue_status,
    lvc_status,
  };
}

export type EnqueuePayloadFromPipeline = {
  qa_pool_entry_id: string;
  confidence_score: number;
  source_type: string;
  jurisdiction: string;
  situation_type?: string | null;
  assigned_to_solicitor_id?: string | null;
  queue_status: 'pending_review' | 'needs_attention';
  lvc_status: 'verified' | 'failed' | 'needs_attention';
  missing_evidence: string[];
  lvc_confidence_score: number;
};

export function buildEnqueuePayloadFromPipeline(
  pipeline: AxiomPipelineResult,
  meta: Omit<EnqueuePayloadFromPipeline, 'queue_status' | 'lvc_status' | 'missing_evidence' | 'lvc_confidence_score'>
): EnqueuePayloadFromPipeline {
  return {
    ...meta,
    queue_status: pipeline.review_queue_status,
    lvc_status: pipeline.lvc_status,
    missing_evidence: pipeline.lvc.missing_evidence,
    lvc_confidence_score: pipeline.lvc.confidence_score,
  };
}

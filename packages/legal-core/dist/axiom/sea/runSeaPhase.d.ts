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
    context?: {
        legal_conclusions?: unknown[];
        reasoning_summary?: string;
    };
};
export type SeaPhaseResult = {
    drafts: string[];
    uncertainty_notes: string[];
    definitive_legal_statements_avoided: boolean;
    request_missing_information: string[];
};
declare const CONFIDENT_THRESHOLD = 70;
/**
 * Produces draft, user-review-oriented copy. When confidence < 70, avoids definitive legal conclusions.
 */
export declare function runSeaPhase(input: SeaPhaseInput): SeaPhaseResult;
export declare function buildSeaInputFromLvc(lvc: VerifyLegalOutput, verifiedPayload: unknown, ctx?: SeaPhaseInput['context']): SeaPhaseInput;
export { CONFIDENT_THRESHOLD };
//# sourceMappingURL=runSeaPhase.d.ts.map
/**
 * LVC — Legal Verification Controller (strict validation between ART and SEA).
 * Deterministic checks only; does not replace human legal review.
 */
export type VerifyLegalInput = {
    extracted_facts: Record<string, unknown>;
    reasoning_output: string | Record<string, unknown>;
    legal_conclusions: Array<Record<string, unknown>>;
};
export type VerifyLegalOutput = {
    verified: boolean;
    errors: string[];
    warnings: string[];
    missing_evidence: string[];
    requires_review: boolean;
    confidence_score: number;
};
/**
 * Validates ART output before SEA. Does not mutate input.
 */
export declare function verifyLegalOutput(input: VerifyLegalInput): VerifyLegalOutput;
export declare function lvcConfidenceBand(score: number): 'unsafe' | 'needs_review' | 'strong';
//# sourceMappingURL=legalVerificationController.d.ts.map
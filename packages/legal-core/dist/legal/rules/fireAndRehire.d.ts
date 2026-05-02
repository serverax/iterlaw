/**
 * Fire-and-rehire / dismissal and re-engagement risk framing (logic only, not legal advice).
 */
export type FinancialNecessityClaimed = true | false | 'unknown';
export type FireAndRehireEvidenceKey = 'insolvency_risk' | 'going_concern_evidence' | 'accounts' | 'consultation_records' | 'alternatives_considered' | 'business_continuity_evidence';
export declare const FIRE_AND_REHIRE_EVIDENCE_CHECKLIST: FireAndRehireEvidenceKey[];
export type FireAndRehireAssessment = {
    highRisk: boolean;
    financial_necessity_claimed: FinancialNecessityClaimed;
    /** Evidence categories that should be requested / reviewed before accepting a necessity defence */
    evidence_required: FireAndRehireEvidenceKey[];
    /** True when employer asserts necessity but no supporting evidence is recorded */
    financial_necessity_unsupported: boolean;
    flags: string[];
};
export type FireAndRehireInput = {
    dismissalAndReengagementPattern: boolean;
    imposedRestrictedVariation: boolean;
    financial_necessity_claimed: FinancialNecessityClaimed;
    /** Keys from FIRE_AND_REHIRE_EVIDENCE_CHECKLIST that the file / intake says are present */
    evidencePresent?: Partial<Record<FireAndRehireEvidenceKey, boolean>>;
};
export declare function assessFireAndRehire(input: FireAndRehireInput): FireAndRehireAssessment;
/** Do not treat financial necessity as established without corroborating material */
export declare function isFinancialNecessityAcceptedWithoutEvidence(input: FireAndRehireInput): boolean;
//# sourceMappingURL=fireAndRehire.d.ts.map
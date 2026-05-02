"use strict";
/**
 * Fire-and-rehire / dismissal and re-engagement risk framing (logic only, not legal advice).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIRE_AND_REHIRE_EVIDENCE_CHECKLIST = void 0;
exports.assessFireAndRehire = assessFireAndRehire;
exports.isFinancialNecessityAcceptedWithoutEvidence = isFinancialNecessityAcceptedWithoutEvidence;
exports.FIRE_AND_REHIRE_EVIDENCE_CHECKLIST = [
    'insolvency_risk',
    'going_concern_evidence',
    'accounts',
    'consultation_records',
    'alternatives_considered',
    'business_continuity_evidence',
];
function assessFireAndRehire(input) {
    const flags = [];
    const triggered = input.dismissalAndReengagementPattern || input.imposedRestrictedVariation;
    if (triggered) {
        flags.push('possible_dismissal_reengagement_or_restricted_variation');
    }
    const evidence_required = [...exports.FIRE_AND_REHIRE_EVIDENCE_CHECKLIST];
    const present = input.evidencePresent ?? {};
    const hasAnyEvidence = evidence_required.some((k) => present[k] === true);
    const financial_necessity_unsupported = input.financial_necessity_claimed === true && !hasAnyEvidence;
    if (input.financial_necessity_claimed === true && !hasAnyEvidence) {
        flags.push('financial_necessity_claimed_without_evidence');
    }
    return {
        highRisk: triggered,
        financial_necessity_claimed: input.financial_necessity_claimed,
        evidence_required,
        financial_necessity_unsupported,
        flags,
    };
}
/** Do not treat financial necessity as established without corroborating material */
function isFinancialNecessityAcceptedWithoutEvidence(input) {
    const a = assessFireAndRehire(input);
    return a.financial_necessity_claimed === true && a.financial_necessity_unsupported;
}

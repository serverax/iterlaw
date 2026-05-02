"use strict";
/**
 * SEA — Safe Enforcement Assistant (backend slice).
 * Receives LVC output; must hedge when confidence is below threshold.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIDENT_THRESHOLD = void 0;
exports.runSeaPhase = runSeaPhase;
exports.buildSeaInputFromLvc = buildSeaInputFromLvc;
const CONFIDENT_THRESHOLD = 70;
exports.CONFIDENT_THRESHOLD = CONFIDENT_THRESHOLD;
/**
 * Produces draft, user-review-oriented copy. When confidence < 70, avoids definitive legal conclusions.
 */
function runSeaPhase(input) {
    const lowConfidence = input.confidence_score < CONFIDENT_THRESHOLD;
    const uncertainty_notes = [];
    const request_missing_information = [...input.missing_evidence];
    if (lowConfidence) {
        uncertainty_notes.push(`Legal verification confidence is ${input.confidence_score}/100 (below ${CONFIDENT_THRESHOLD}). Wording is intentionally cautious and non-definitive.`);
    }
    for (const w of input.warnings) {
        uncertainty_notes.push(`Review note: ${w}`);
    }
    const drafts = [];
    if (lowConfidence) {
        drafts.push('**Draft (non-definitive)** — The situation may depend on facts and evidence not yet confirmed. ' +
            'Consider gathering the items listed under “information to obtain” before relying on any next step. ' +
            'This is not legal advice; a qualified adviser should review your position.');
    }
    else {
        drafts.push('**Draft for user review** — Next practical steps are suggested below. Outcomes are not guaranteed; verify dates, sources, and workplace documents.');
    }
    if (input.missing_evidence.length > 0) {
        drafts.push('**Information to obtain**\n' +
            input.missing_evidence.map((m) => `- ${m}`).join('\n'));
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
function buildSeaInputFromLvc(lvc, verifiedPayload, ctx) {
    return {
        verified_output: verifiedPayload,
        warnings: lvc.warnings,
        missing_evidence: lvc.missing_evidence,
        confidence_score: lvc.confidence_score,
        context: ctx,
    };
}

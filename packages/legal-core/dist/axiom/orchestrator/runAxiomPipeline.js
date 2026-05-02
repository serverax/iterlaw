"use strict";
/**
 * Backend axiom pipeline: AEE → ART → LVC → SEA.
 * AEE/ART are treated as upstream inputs (produced elsewhere); this module wires LVC + SEA only.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAxiomPipeline = runAxiomPipeline;
exports.buildEnqueuePayloadFromPipeline = buildEnqueuePayloadFromPipeline;
const legalVerificationController_1 = require("../lvc/legalVerificationController");
const runSeaPhase_1 = require("../sea/runSeaPhase");
/**
 * Runs LVC after ART. SEA runs only when `lvc.verified` and confidence ≥ 70.
 * Otherwise SEA is skipped (no definitive downstream drafting from unverified chains).
 */
function runAxiomPipeline(input) {
    const lvcInput = {
        extracted_facts: input.extracted_facts,
        reasoning_output: input.reasoning_output,
        legal_conclusions: input.legal_conclusions,
    };
    const lvc = (0, legalVerificationController_1.verifyLegalOutput)(lvcInput);
    const seaAllowed = lvc.verified && lvc.confidence_score >= 70;
    const sea = seaAllowed
        ? (0, runSeaPhase_1.runSeaPhase)((0, runSeaPhase_1.buildSeaInputFromLvc)(lvc, {
            extracted_facts: input.extracted_facts,
            reasoning_output: input.reasoning_output,
            legal_conclusions: input.legal_conclusions,
        }, {
            legal_conclusions: input.legal_conclusions,
            reasoning_summary: typeof input.reasoning_output === 'string'
                ? input.reasoning_output
                : JSON.stringify(input.reasoning_output).slice(0, 4000),
        }))
        : null;
    const lvc_status = lvc.verified
        ? seaAllowed
            ? 'verified'
            : 'needs_attention'
        : 'failed';
    const review_queue_status = lvc.verified && seaAllowed ? 'pending_review' : 'needs_attention';
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
function buildEnqueuePayloadFromPipeline(pipeline, meta) {
    return {
        ...meta,
        queue_status: pipeline.review_queue_status,
        lvc_status: pipeline.lvc_status,
        missing_evidence: pipeline.lvc.missing_evidence,
        lvc_confidence_score: pipeline.lvc.confidence_score,
    };
}

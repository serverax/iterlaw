"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalReviewError = exports.rejectAnswerSchema = exports.approveWithDisclaimerSchema = exports.approveAnswerSchema = exports.enqueueForLegalReviewSchema = exports.lvcStatusSchema = exports.TERMINAL_QUEUE_STATUSES = exports.rejectionReasonSchema = exports.reviewAuditDecisionSchema = exports.reviewQueueStatusSchema = void 0;
const zod_1 = require("zod");
exports.reviewQueueStatusSchema = zod_1.z.enum([
    'pending_review',
    'in_review',
    'needs_attention',
    'approved',
    'approved_with_disclaimer',
    'rejected',
]);
exports.reviewAuditDecisionSchema = zod_1.z.enum(['approved', 'approved_with_disclaimer', 'rejected']);
exports.rejectionReasonSchema = zod_1.z.enum([
    'inaccurate_law',
    'inaccurate_meaning',
    'unsafe_action',
    'source_missing',
    'needs_legal_advice',
]);
exports.TERMINAL_QUEUE_STATUSES = [
    'approved',
    'approved_with_disclaimer',
    'rejected',
];
exports.lvcStatusSchema = zod_1.z.enum(['verified', 'failed', 'needs_attention']);
exports.enqueueForLegalReviewSchema = zod_1.z.object({
    qa_pool_entry_id: zod_1.z.string().uuid(),
    confidence_score: zod_1.z.number(),
    source_type: zod_1.z.string().max(20),
    jurisdiction: zod_1.z.string().max(20),
    situation_type: zod_1.z.string().max(50).optional().nullable(),
    assigned_to_solicitor_id: zod_1.z.string().uuid().optional().nullable(),
    queue_status: zod_1.z.enum(['pending_review', 'in_review', 'needs_attention']).optional(),
    lvc_status: exports.lvcStatusSchema.optional(),
    missing_evidence: zod_1.z.array(zod_1.z.string()).optional(),
    lvc_confidence_score: zod_1.z.number().int().min(0).max(100).optional(),
});
const baseTransitionSchema = zod_1.z.object({
    review_queue_id: zod_1.z.string().uuid(),
    qa_pool_entry_id: zod_1.z.string().uuid(),
    reviewer_id: zod_1.z.string().uuid().optional().nullable(),
    expires_at: zod_1.z.string().datetime({ offset: true }).optional().nullable(),
});
exports.approveAnswerSchema = baseTransitionSchema;
exports.approveWithDisclaimerSchema = baseTransitionSchema.extend({
    disclaimer_text: zod_1.z.string().max(10_000).optional().nullable(),
});
exports.rejectAnswerSchema = baseTransitionSchema.extend({
    rejection_reason: exports.rejectionReasonSchema,
    rejection_detail: zod_1.z.string().max(10_000).optional().nullable(),
    review_duration_seconds: zod_1.z.number().int().min(0).optional().nullable(),
});
class LegalReviewError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'LegalReviewError';
    }
}
exports.LegalReviewError = LegalReviewError;

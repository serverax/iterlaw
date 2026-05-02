import { z } from 'zod';
export declare const reviewQueueStatusSchema: z.ZodEnum<["pending_review", "in_review", "needs_attention", "approved", "approved_with_disclaimer", "rejected"]>;
export type ReviewQueueStatus = z.infer<typeof reviewQueueStatusSchema>;
export declare const reviewAuditDecisionSchema: z.ZodEnum<["approved", "approved_with_disclaimer", "rejected"]>;
export type ReviewAuditDecision = z.infer<typeof reviewAuditDecisionSchema>;
export declare const rejectionReasonSchema: z.ZodEnum<["inaccurate_law", "inaccurate_meaning", "unsafe_action", "source_missing", "needs_legal_advice"]>;
export type RejectionReason = z.infer<typeof rejectionReasonSchema>;
export declare const TERMINAL_QUEUE_STATUSES: ReviewQueueStatus[];
export declare const lvcStatusSchema: z.ZodEnum<["verified", "failed", "needs_attention"]>;
export type LvcStatus = z.infer<typeof lvcStatusSchema>;
export declare const enqueueForLegalReviewSchema: z.ZodObject<{
    qa_pool_entry_id: z.ZodString;
    confidence_score: z.ZodNumber;
    source_type: z.ZodString;
    jurisdiction: z.ZodString;
    situation_type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    assigned_to_solicitor_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    queue_status: z.ZodOptional<z.ZodEnum<["pending_review", "in_review", "needs_attention"]>>;
    lvc_status: z.ZodOptional<z.ZodEnum<["verified", "failed", "needs_attention"]>>;
    missing_evidence: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    lvc_confidence_score: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    qa_pool_entry_id: string;
    confidence_score: number;
    source_type: string;
    jurisdiction: string;
    situation_type?: string | null | undefined;
    assigned_to_solicitor_id?: string | null | undefined;
    queue_status?: "pending_review" | "in_review" | "needs_attention" | undefined;
    lvc_status?: "needs_attention" | "verified" | "failed" | undefined;
    missing_evidence?: string[] | undefined;
    lvc_confidence_score?: number | undefined;
}, {
    qa_pool_entry_id: string;
    confidence_score: number;
    source_type: string;
    jurisdiction: string;
    situation_type?: string | null | undefined;
    assigned_to_solicitor_id?: string | null | undefined;
    queue_status?: "pending_review" | "in_review" | "needs_attention" | undefined;
    lvc_status?: "needs_attention" | "verified" | "failed" | undefined;
    missing_evidence?: string[] | undefined;
    lvc_confidence_score?: number | undefined;
}>;
export type EnqueueForLegalReviewInput = z.infer<typeof enqueueForLegalReviewSchema>;
export declare const approveAnswerSchema: z.ZodObject<{
    review_queue_id: z.ZodString;
    qa_pool_entry_id: z.ZodString;
    reviewer_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    expires_at: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    qa_pool_entry_id: string;
    review_queue_id: string;
    reviewer_id?: string | null | undefined;
    expires_at?: string | null | undefined;
}, {
    qa_pool_entry_id: string;
    review_queue_id: string;
    reviewer_id?: string | null | undefined;
    expires_at?: string | null | undefined;
}>;
export type ApproveAnswerInput = z.infer<typeof approveAnswerSchema>;
export declare const approveWithDisclaimerSchema: z.ZodObject<{
    review_queue_id: z.ZodString;
    qa_pool_entry_id: z.ZodString;
    reviewer_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    expires_at: z.ZodNullable<z.ZodOptional<z.ZodString>>;
} & {
    disclaimer_text: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    qa_pool_entry_id: string;
    review_queue_id: string;
    reviewer_id?: string | null | undefined;
    expires_at?: string | null | undefined;
    disclaimer_text?: string | null | undefined;
}, {
    qa_pool_entry_id: string;
    review_queue_id: string;
    reviewer_id?: string | null | undefined;
    expires_at?: string | null | undefined;
    disclaimer_text?: string | null | undefined;
}>;
export type ApproveWithDisclaimerInput = z.infer<typeof approveWithDisclaimerSchema>;
export declare const rejectAnswerSchema: z.ZodObject<{
    review_queue_id: z.ZodString;
    qa_pool_entry_id: z.ZodString;
    reviewer_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    expires_at: z.ZodNullable<z.ZodOptional<z.ZodString>>;
} & {
    rejection_reason: z.ZodEnum<["inaccurate_law", "inaccurate_meaning", "unsafe_action", "source_missing", "needs_legal_advice"]>;
    rejection_detail: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    review_duration_seconds: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    qa_pool_entry_id: string;
    review_queue_id: string;
    rejection_reason: "inaccurate_law" | "inaccurate_meaning" | "unsafe_action" | "source_missing" | "needs_legal_advice";
    reviewer_id?: string | null | undefined;
    expires_at?: string | null | undefined;
    rejection_detail?: string | null | undefined;
    review_duration_seconds?: number | null | undefined;
}, {
    qa_pool_entry_id: string;
    review_queue_id: string;
    rejection_reason: "inaccurate_law" | "inaccurate_meaning" | "unsafe_action" | "source_missing" | "needs_legal_advice";
    reviewer_id?: string | null | undefined;
    expires_at?: string | null | undefined;
    rejection_detail?: string | null | undefined;
    review_duration_seconds?: number | null | undefined;
}>;
export type RejectAnswerInput = z.infer<typeof rejectAnswerSchema>;
export declare class LegalReviewError extends Error {
    readonly code: 'QUEUE_NOT_FOUND' | 'QUEUE_TERMINAL' | 'ENTRY_MISMATCH' | 'AUDIT_WRITE_FAILED' | 'POOL_UPDATE_FAILED' | 'QUEUE_UPDATE_FAILED' | 'QUEUE_READ_FAILED' | 'POOL_ENTRY_NOT_FOUND' | 'ALREADY_QUEUED' | 'RPC_FAILED' | 'VALIDATION';
    constructor(message: string, code: 'QUEUE_NOT_FOUND' | 'QUEUE_TERMINAL' | 'ENTRY_MISMATCH' | 'AUDIT_WRITE_FAILED' | 'POOL_UPDATE_FAILED' | 'QUEUE_UPDATE_FAILED' | 'QUEUE_READ_FAILED' | 'POOL_ENTRY_NOT_FOUND' | 'ALREADY_QUEUED' | 'RPC_FAILED' | 'VALIDATION');
}
//# sourceMappingURL=legal-review.d.ts.map
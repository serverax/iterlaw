import { z } from 'zod';

export const reviewQueueStatusSchema = z.enum([
  'pending_review',
  'in_review',
  'approved',
  'approved_with_disclaimer',
  'rejected',
]);

export type ReviewQueueStatus = z.infer<typeof reviewQueueStatusSchema>;

export const reviewAuditDecisionSchema = z.enum(['approved', 'approved_with_disclaimer', 'rejected']);

export type ReviewAuditDecision = z.infer<typeof reviewAuditDecisionSchema>;

export const rejectionReasonSchema = z.enum([
  'inaccurate_law',
  'inaccurate_meaning',
  'unsafe_action',
  'source_missing',
  'needs_legal_advice',
]);

export type RejectionReason = z.infer<typeof rejectionReasonSchema>;

export const TERMINAL_QUEUE_STATUSES: ReviewQueueStatus[] = [
  'approved',
  'approved_with_disclaimer',
  'rejected',
];

export const enqueueForLegalReviewSchema = z.object({
  qa_pool_entry_id: z.string().uuid(),
  confidence_score: z.number(),
  source_type: z.string().max(20),
  jurisdiction: z.string().max(20),
  situation_type: z.string().max(50).optional().nullable(),
  assigned_to_solicitor_id: z.string().uuid().optional().nullable(),
});

export type EnqueueForLegalReviewInput = z.infer<typeof enqueueForLegalReviewSchema>;

const baseTransitionSchema = z.object({
  review_queue_id: z.string().uuid(),
  qa_pool_entry_id: z.string().uuid(),
  reviewer_id: z.string().uuid().optional().nullable(),
  expires_at: z.string().datetime({ offset: true }).optional().nullable(),
});

export const approveAnswerSchema = baseTransitionSchema;

export type ApproveAnswerInput = z.infer<typeof approveAnswerSchema>;

export const approveWithDisclaimerSchema = baseTransitionSchema.extend({
  disclaimer_text: z.string().max(10_000).optional().nullable(),
});

export type ApproveWithDisclaimerInput = z.infer<typeof approveWithDisclaimerSchema>;

export const rejectAnswerSchema = baseTransitionSchema.extend({
  rejection_reason: rejectionReasonSchema,
  rejection_detail: z.string().max(10_000).optional().nullable(),
  review_duration_seconds: z.number().int().min(0).optional().nullable(),
});

export type RejectAnswerInput = z.infer<typeof rejectAnswerSchema>;

export class LegalReviewError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'QUEUE_NOT_FOUND'
      | 'QUEUE_TERMINAL'
      | 'ENTRY_MISMATCH'
      | 'AUDIT_WRITE_FAILED'
      | 'POOL_UPDATE_FAILED'
      | 'QUEUE_UPDATE_FAILED'
      | 'QUEUE_READ_FAILED'
      | 'VALIDATION'
  ) {
    super(message);
    this.name = 'LegalReviewError';
  }
}

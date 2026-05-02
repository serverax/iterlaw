import { z } from 'zod';

/** POST /api/answer — create draft; response is always under_review until approved. */
export const createAnswerBodySchema = z.object({
  jurisdiction: z.string().min(2).max(20),
  question_text: z.string().min(1).max(20_000),
  document_text: z.string().max(100_000).optional(),
  /** Optional structured hints (never trust for security; validated server-side). */
  extracted_hints: z.record(z.unknown()).optional(),
  /**
   * Trusted server fields — set only by your backend after auth (do not trust from browsers
   * when Functions uses anonymous auth). Omitted ⇒ free tier + no premium escalation.
   */
  user_id: z.string().uuid().optional(),
  caller_role: z.enum(['free', 'registered', 'admin']).optional().default('free'),
  /** Legal reviewer flagged this case for premium model use (manual escalation). */
  reviewer_escalated_premium: z.boolean().optional().default(false),
  /** Requested OpenRouter / provider model id; empty ⇒ cheap default from env. */
  requested_model: z.string().max(200).optional(),
});

export type CreateAnswerBody = z.infer<typeof createAnswerBodySchema>;

export const legalReviewApproveBodySchema = z.object({
  qa_pool_entry_id: z.string().uuid(),
  reviewer_id: z.string().uuid().optional().nullable(),
  expires_at: z.string().datetime({ offset: true }).optional().nullable(),
});

export type LegalReviewApproveBody = z.infer<typeof legalReviewApproveBodySchema>;

export const legalReviewRejectBodySchema = z.object({
  qa_pool_entry_id: z.string().uuid(),
  reviewer_id: z.string().uuid().optional().nullable(),
  expires_at: z.string().datetime({ offset: true }).optional().nullable(),
  rejection_reason: z.enum([
    'inaccurate_law',
    'inaccurate_meaning',
    'unsafe_action',
    'source_missing',
    'needs_legal_advice',
  ]),
  rejection_detail: z.string().max(10_000).optional().nullable(),
  review_duration_seconds: z.number().int().min(0).optional().nullable(),
});

export type LegalReviewRejectBody = z.infer<typeof legalReviewRejectBodySchema>;

export type UnderReviewResponse = {
  status: 'under_review';
  answer_id: string;
  review_queue_id: string;
};

export type AnswerNotAvailableResponse = {
  status: 'not_available';
  reason: string;
};

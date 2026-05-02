import type { SupabaseClient } from '@supabase/supabase-js';
import {
  approveAnswerSchema,
  enqueueForLegalReviewSchema,
  LegalReviewError,
  rejectAnswerSchema,
  TERMINAL_QUEUE_STATUSES,
  type ApproveAnswerInput,
  type EnqueueForLegalReviewInput,
  type RejectAnswerInput,
  type ReviewQueueStatus,
} from '@rightsnow/shared';

function nowIso(): string {
  return new Date().toISOString();
}

type PostgrestLikeError = { message: string; code?: string; details?: string };

export function mapEnqueueLegalReviewRpcError(err: PostgrestLikeError): LegalReviewError {
  const msg = err.message ?? '';
  const details = err.details ?? '';
  const combined = `${msg} ${details}`.trim();

  if (combined.includes('POOL_ENTRY_NOT_FOUND')) {
    return new LegalReviewError('qa_pool_entries row not found for enqueue', 'POOL_ENTRY_NOT_FOUND');
  }
  if (combined.includes('ALREADY_QUEUED') || err.code === '23505') {
    return new LegalReviewError(
      'This answer is already queued for legal review (pending or in review)',
      'ALREADY_QUEUED'
    );
  }
  if (combined.includes('INVALID_QUEUE_STATUS') || combined.includes('INVALID_LVC_STATUS')) {
    return new LegalReviewError(combined, 'VALIDATION');
  }
  return new LegalReviewError(`enqueue_legal_review RPC: ${msg}`, 'RPC_FAILED');
}

async function assertQueueOpenForTransition(
  sb: SupabaseClient,
  review_queue_id: string,
  qa_pool_entry_id: string
): Promise<{ status: ReviewQueueStatus }> {
  const { data, error } = await sb
    .from('review_queue')
    .select('id, status, qa_pool_entry_id')
    .eq('id', review_queue_id)
    .maybeSingle();

  if (error) throw new LegalReviewError(error.message, 'QUEUE_NOT_FOUND');
  if (!data) throw new LegalReviewError('Review queue row not found', 'QUEUE_NOT_FOUND');
  if (data.qa_pool_entry_id !== qa_pool_entry_id) {
    throw new LegalReviewError('qa_pool_entry_id does not match review_queue row', 'ENTRY_MISMATCH');
  }
  if (TERMINAL_QUEUE_STATUSES.includes(data.status as ReviewQueueStatus)) {
    throw new LegalReviewError(`Review queue is already terminal: ${data.status}`, 'QUEUE_TERMINAL');
  }
  return { status: data.status as ReviewQueueStatus };
}

export async function enqueueForLegalReview(
  sb: SupabaseClient,
  raw: EnqueueForLegalReviewInput
): Promise<{ review_queue_id: string }> {
  const input = enqueueForLegalReviewSchema.parse(raw);
  const rawScore = Number(input.confidence_score);
  const lvcConfidence =
    input.lvc_confidence_score ??
    (rawScore <= 1
      ? Math.min(100, Math.max(0, Math.round(rawScore * 100)))
      : Math.min(100, Math.max(0, Math.round(rawScore))));

  const { data, error } = await sb.rpc('enqueue_legal_review', {
    p_qa_pool_entry_id: input.qa_pool_entry_id,
    p_confidence_score: input.confidence_score,
    p_source_type: input.source_type,
    p_jurisdiction: input.jurisdiction,
    p_situation_type: input.situation_type ?? null,
    p_assigned_to_solicitor_id: input.assigned_to_solicitor_id ?? null,
    p_queue_status: input.queue_status ?? 'pending_review',
    p_lvc_status: input.lvc_status ?? 'needs_attention',
    p_missing_evidence: input.missing_evidence ?? [],
    p_lvc_confidence: lvcConfidence,
  });

  if (error) {
    throw mapEnqueueLegalReviewRpcError(error);
  }
  if (data === null || data === undefined) {
    throw new LegalReviewError('enqueue_legal_review returned no id', 'RPC_FAILED');
  }
  return { review_queue_id: String(data) };
}

export async function approveAnswer(sb: SupabaseClient, raw: ApproveAnswerInput): Promise<void> {
  const input = approveAnswerSchema.parse(raw);
  await assertQueueOpenForTransition(sb, input.review_queue_id, input.qa_pool_entry_id);
  const ts = nowIso();

  const poolPatch = {
    legal_reviewer_approved: true,
    is_active: true,
    decision: 'approved',
    disclaimer_required: false,
    reviewed_at: ts,
    reviewed_by_solicitor_id: input.reviewer_id ?? null,
    expires_at: input.expires_at ?? null,
    updated_at: ts,
  };

  const { error: poolErr } = await sb.from('qa_pool_entries').update(poolPatch).eq('id', input.qa_pool_entry_id);
  if (poolErr) throw new LegalReviewError(`qa_pool_entries: ${poolErr.message}`, 'POOL_UPDATE_FAILED');

  const { error: qErr } = await sb
    .from('review_queue')
    .update({
      status: 'approved',
      lvc_status: 'verified',
      review_completed_at: ts,
      updated_at: ts,
    })
    .eq('id', input.review_queue_id);

  if (qErr) throw new LegalReviewError(`review_queue: ${qErr.message}`, 'QUEUE_UPDATE_FAILED');

  const { error: aErr } = await sb.from('review_audit_log').insert({
    qa_pool_entry_id: input.qa_pool_entry_id,
    reviewer_id: input.reviewer_id ?? null,
    decision: 'approved',
    rejection_reason: null,
    rejection_detail: null,
    disclaimer_text: null,
    review_duration_seconds: null,
  });

  if (aErr) {
    throw new LegalReviewError(
      `review_audit_log: ${aErr.message}. Earlier steps may have committed; reconcile manually or add transactional RPC.`,
      'AUDIT_WRITE_FAILED'
    );
  }
}

export async function rejectAnswer(sb: SupabaseClient, raw: RejectAnswerInput): Promise<void> {
  const input = rejectAnswerSchema.parse(raw);
  await assertQueueOpenForTransition(sb, input.review_queue_id, input.qa_pool_entry_id);
  const ts = nowIso();

  const poolPatch = {
    legal_reviewer_approved: false,
    is_active: false,
    decision: 'rejected',
    disclaimer_required: false,
    reviewed_at: ts,
    reviewed_by_solicitor_id: input.reviewer_id ?? null,
    expires_at: input.expires_at ?? null,
    updated_at: ts,
  };

  const { error: poolErr } = await sb.from('qa_pool_entries').update(poolPatch).eq('id', input.qa_pool_entry_id);
  if (poolErr) throw new LegalReviewError(`qa_pool_entries: ${poolErr.message}`, 'POOL_UPDATE_FAILED');

  const { error: qErr } = await sb
    .from('review_queue')
    .update({
      status: 'rejected',
      review_completed_at: ts,
      updated_at: ts,
    })
    .eq('id', input.review_queue_id);

  if (qErr) throw new LegalReviewError(`review_queue: ${qErr.message}`, 'QUEUE_UPDATE_FAILED');

  const { error: aErr } = await sb.from('review_audit_log').insert({
    qa_pool_entry_id: input.qa_pool_entry_id,
    reviewer_id: input.reviewer_id ?? null,
    decision: 'rejected',
    rejection_reason: input.rejection_reason,
    rejection_detail: input.rejection_detail ?? null,
    disclaimer_text: null,
    review_duration_seconds: input.review_duration_seconds ?? null,
  });

  if (aErr) {
    throw new LegalReviewError(
      `review_audit_log: ${aErr.message}. Earlier steps may have committed; reconcile manually or add transactional RPC.`,
      'AUDIT_WRITE_FAILED'
    );
  }
}

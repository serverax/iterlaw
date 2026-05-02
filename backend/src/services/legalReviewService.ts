/**
 * Legal review workflow (STEP 2A). Migration 011 schema only.
 *
 * Atomicity: pool → queue → audit log are applied sequentially. If the audit insert
 * fails after earlier steps succeed, this throws AUDIT_WRITE_FAILED — deploy a
 * Postgres RPC wrapping a single transaction for production hardening (see STEP 2A spec).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  approveAnswerSchema,
  approveWithDisclaimerSchema,
  enqueueForLegalReviewSchema,
  LegalReviewError,
  rejectAnswerSchema,
  TERMINAL_QUEUE_STATUSES,
  type ApproveAnswerInput,
  type ApproveWithDisclaimerInput,
  type EnqueueForLegalReviewInput,
  type RejectAnswerInput,
  type ReviewQueueStatus,
} from '../types/legalReview';

function nowIso(): string {
  return new Date().toISOString();
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

export async function listPendingLegalReviews(sb: SupabaseClient): Promise<unknown[]> {
  const { data, error } = await sb
    .from('review_queue')
    .select('*')
    .in('status', ['pending_review', 'in_review'])
    .order('date_queued', { ascending: false });

  if (error) {
    throw new LegalReviewError(`review_queue list: ${error.message}`, 'QUEUE_READ_FAILED');
  }
  return data ?? [];
}

export async function enqueueForLegalReview(
  sb: SupabaseClient,
  raw: EnqueueForLegalReviewInput
): Promise<{ review_queue_id: string }> {
  const input = enqueueForLegalReviewSchema.parse(raw);
  const { data, error } = await sb
    .from('review_queue')
    .insert({
      qa_pool_entry_id: input.qa_pool_entry_id,
      confidence_score: input.confidence_score,
      source_type: input.source_type,
      jurisdiction: input.jurisdiction,
      situation_type: input.situation_type ?? null,
      assigned_to_solicitor_id: input.assigned_to_solicitor_id ?? null,
      status: 'pending_review',
      updated_at: nowIso(),
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new LegalReviewError(error?.message ?? 'Failed to insert review_queue', 'QUEUE_UPDATE_FAILED');
  }
  return { review_queue_id: data.id as string };
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

export async function approveWithDisclaimer(sb: SupabaseClient, raw: ApproveWithDisclaimerInput): Promise<void> {
  const input = approveWithDisclaimerSchema.parse(raw);
  await assertQueueOpenForTransition(sb, input.review_queue_id, input.qa_pool_entry_id);
  const ts = nowIso();

  const poolPatch = {
    legal_reviewer_approved: true,
    is_active: true,
    decision: 'approved_with_disclaimer',
    disclaimer_required: true,
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
      status: 'approved_with_disclaimer',
      review_completed_at: ts,
      updated_at: ts,
    })
    .eq('id', input.review_queue_id);

  if (qErr) throw new LegalReviewError(`review_queue: ${qErr.message}`, 'QUEUE_UPDATE_FAILED');

  const { error: aErr } = await sb.from('review_audit_log').insert({
    qa_pool_entry_id: input.qa_pool_entry_id,
    reviewer_id: input.reviewer_id ?? null,
    decision: 'approved_with_disclaimer',
    rejection_reason: null,
    rejection_detail: null,
    disclaimer_text: input.disclaimer_text ?? null,
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

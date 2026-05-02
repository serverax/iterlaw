/**
 * Manual legal-review lifecycle check.
 *
 * Run from repo `backend/` with service role env set:
 *   npx tsx scripts/test-legal-review.ts
 *
 * Requires: migration 011 applied; `qa_pool_entries` table exists (Step 7 pool migration).
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { loadEnv } from '../src/config/env';
import { createServiceSupabase } from '../src/config/supabase';
import {
  approveAnswer,
  enqueueForLegalReview,
  rejectAnswer,
} from '../src/services/legalReviewService';

async function insertPoolRow(
  sb: ReturnType<typeof createServiceSupabase>,
  suffix: string
): Promise<string> {
  const content_hash = `manual-test-${suffix}-${Date.now()}`;
  const { data, error } = await sb
    .from('qa_pool_entries')
    .insert({
      jurisdiction: 'england_wales',
      content_hash,
      question_text: `Manual test question ${suffix}`,
      answer: { law: 'n/a', meaning: 'n/a', action: 'n/a', source: { title: 'test', citation: 'test' }, confidence: 0, cached: false },
      source: 'ai',
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`insert qa_pool_entries: ${error?.message ?? 'no row'}`);
  }
  return data.id as string;
}

async function logQueue(sb: ReturnType<typeof createServiceSupabase>, id: string, label: string): Promise<void> {
  const { data, error } = await sb.from('review_queue').select('*').eq('id', id).maybeSingle();
  if (error) console.log(`[${label}] queue read error`, error.message);
  else console.log(`[${label}] review_queue row`, JSON.stringify(data, null, 2));
}

async function logPool(sb: ReturnType<typeof createServiceSupabase>, id: string, label: string): Promise<void> {
  const { data, error } = await sb
    .from('qa_pool_entries')
    .select(
      'id, legal_reviewer_approved, is_active, decision, disclaimer_required, reviewed_at, reviewed_by_solicitor_id'
    )
    .eq('id', id)
    .maybeSingle();
  if (error) console.log(`[${label}] pool read error`, error.message);
  else console.log(`[${label}] qa_pool_entries row`, JSON.stringify(data, null, 2));
}

async function logAuditTrail(
  sb: ReturnType<typeof createServiceSupabase>,
  poolIds: string[],
  label: string
): Promise<void> {
  const { data, error } = await sb
    .from('review_audit_log')
    .select('*')
    .in('qa_pool_entry_id', poolIds)
    .order('reviewed_at', { ascending: true });
  if (error) console.log(`[${label}] audit read error`, error.message);
  else console.log(`[${label}] review_audit_log (${data?.length ?? 0} rows)`, JSON.stringify(data, null, 2));
}

async function cleanup(
  sb: ReturnType<typeof createServiceSupabase>,
  poolIds: string[]
): Promise<void> {
  for (const id of poolIds) {
    await sb.from('review_audit_log').delete().eq('qa_pool_entry_id', id);
    await sb.from('review_queue').delete().eq('qa_pool_entry_id', id);
    await sb.from('qa_pool_entries').delete().eq('id', id);
  }
  console.log('[cleanup] removed test pool rows (and dependent queue/audit).');
}

async function main(): Promise<void> {
  const env = loadEnv();
  const sb = createServiceSupabase(env);
  const reviewerId = randomUUID();
  const poolIds: string[] = [];

  console.log('=== Legal review manual test ===\n');

  try {
    // --- Case A: approve ---
    console.log('--- Case A: enqueue → approve ---\n');
    const poolA = await insertPoolRow(sb, 'approve-case');
    poolIds.push(poolA);
    console.log('[A] qa_pool_entry created', poolA);

    const enqA = await enqueueForLegalReview(sb, {
      qa_pool_entry_id: poolA,
      confidence_score: 0.72,
      source_type: 'ai',
      jurisdiction: 'england_wales',
      situation_type: 'unfair_dismissal',
      assigned_to_solicitor_id: null,
    });
    console.log('[A] queue created', enqA);
    await logQueue(sb, enqA.review_queue_id, 'A-after-enqueue');

    await approveAnswer(sb, {
      review_queue_id: enqA.review_queue_id,
      qa_pool_entry_id: poolA,
      reviewer_id: reviewerId,
      expires_at: null,
    });
    console.log('[A] approveAnswer completed');
    await logQueue(sb, enqA.review_queue_id, 'A-after-approve');
    await logPool(sb, poolA, 'A-after-approve');

    // --- Case B: reject (separate pool + queue) ---
    console.log('\n--- Case B: enqueue → reject ---\n');
    const poolB = await insertPoolRow(sb, 'reject-case');
    poolIds.push(poolB);
    console.log('[B] qa_pool_entry created', poolB);

    const enqB = await enqueueForLegalReview(sb, {
      qa_pool_entry_id: poolB,
      confidence_score: 0.55,
      source_type: 'gov',
      jurisdiction: 'england_wales',
      situation_type: null,
      assigned_to_solicitor_id: null,
    });
    console.log('[B] queue created', enqB);
    await logQueue(sb, enqB.review_queue_id, 'B-after-enqueue');

    await rejectAnswer(sb, {
      review_queue_id: enqB.review_queue_id,
      qa_pool_entry_id: poolB,
      reviewer_id: reviewerId,
      expires_at: null,
      rejection_reason: 'inaccurate_law',
      rejection_detail: 'manual test rejection',
      review_duration_seconds: 120,
    });
    console.log('[B] rejectAnswer completed');
    await logQueue(sb, enqB.review_queue_id, 'B-after-reject');
    await logPool(sb, poolB, 'B-after-reject');

    // --- Audit trail (both cases) ---
    console.log('\n--- Audit trail (both pool entries) ---\n');
    await logAuditTrail(sb, [poolA, poolB], 'all');

    console.log('\n=== Done (set CLEANUP=0 to keep rows for inspection) ===');
    if (process.env.CLEANUP !== '0') {
      await cleanup(sb, poolIds);
    } else {
      console.log('[cleanup] skipped (CLEANUP=0). Pool ids:', poolIds.join(', '));
    }
  } catch (e) {
    console.error('Test failed:', e);
    if (poolIds.length) {
      console.log('[cleanup] after error…');
      await cleanup(sb, poolIds).catch(() => undefined);
    }
    process.exitCode = 1;
  }
}

void main();

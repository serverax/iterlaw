import type { SupabaseClient } from '@supabase/supabase-js';
import type { AskBody, ControlledAskOutcome, ResponseType, WireVerifiedAskResponse } from '../types/controlledAsk';

const STOP = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'to',
  'of',
  'in',
  'on',
  'for',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'my',
  'me',
  'i',
  'we',
  'you',
  'it',
  'this',
  'that',
  'what',
  'when',
  'how',
  'can',
  'could',
  'should',
  'would',
  'will',
  'with',
  'at',
  'by',
  'from',
  'as',
  'if',
  'about',
  'into',
  'uk',
]);

export function tokenizeQuestion(q: string): string[] {
  const raw = q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP.has(t));
  return [...new Set(raw)];
}

function scoreTokensAgainstText(tokens: string[], text: string): number {
  if (tokens.length === 0) return 0;
  const hay = text.toLowerCase();
  let hits = 0;
  for (const t of tokens) {
    if (hay.includes(t)) hits += 1;
  }
  return hits;
}

function minHitsForMatch(tokens: string[]): number {
  if (tokens.length === 0) return 999;
  if (tokens.length <= 2) return Math.max(1, tokens.length);
  return Math.max(2, Math.ceil(tokens.length * 0.35));
}

type QaPoolRow = {
  id: string;
  question: string;
  answer: string;
  source: string;
  approved: boolean;
};

type TrustedRow = {
  id: string;
  title: string;
  content: string;
  source: string;
  tags: string[] | null;
};

const QA_FETCH_LIMIT = 400;
const TRUSTED_FETCH_LIMIT = 400;

export async function matchApprovedQaPool(
  sb: SupabaseClient,
  question: string
): Promise<QaPoolRow | null> {
  const tokens = tokenizeQuestion(question);
  const minHits = minHitsForMatch(tokens);

  const { data, error } = await sb
    .from('qa_pool')
    .select('id, question, answer, source, approved')
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(QA_FETCH_LIMIT);

  if (error) throw new Error(`qa_pool: ${error.message}`);
  const rows = (data ?? []) as QaPoolRow[];
  let best: { row: QaPoolRow; score: number } | null = null;
  for (const row of rows) {
    const hay = `${row.question}\n${row.answer}`;
    const score = scoreTokensAgainstText(tokens, hay);
    if (score >= minHits && (!best || score > best.score)) {
      best = { row, score };
    }
  }
  return best?.row ?? null;
}

export async function matchTrustedContent(
  sb: SupabaseClient,
  question: string
): Promise<TrustedRow | null> {
  const tokens = tokenizeQuestion(question);
  const minHits = minHitsForMatch(tokens);

  const { data, error } = await sb
    .from('trusted_content')
    .select('id, title, content, source, tags')
    .order('created_at', { ascending: false })
    .limit(TRUSTED_FETCH_LIMIT);

  if (error) throw new Error(`trusted_content: ${error.message}`);
  const rows = (data ?? []) as TrustedRow[];
  let best: { row: TrustedRow; score: number } | null = null;
  for (const row of rows) {
    const tagStr = (row.tags ?? []).join(' ');
    const hay = `${row.title}\n${row.content}\n${tagStr}`;
    const score = scoreTokensAgainstText(tokens, hay);
    if (score >= minHits && (!best || score > best.score)) {
      best = { row, score };
    }
  }
  return best?.row ?? null;
}

export async function enqueueLegalReview(
  sb: SupabaseClient,
  question: string
): Promise<{ id: string }> {
  const { data, error } = await sb
    .from('legal_review_queue')
    .insert({
      question,
      generated_answer: null,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) throw new Error(`legal_review_queue: ${error.message}`);
  return { id: data!.id as string };
}

export async function logAskRequest(
  sb: SupabaseClient,
  params: { question: string; source_used: string | null; response_type: ResponseType }
): Promise<void> {
  const { error } = await sb.from('ask_request_logs').insert({
    question: params.question,
    source_used: params.source_used,
    response_type: params.response_type,
  });
  if (error) {
    console.error('[ask_request_logs]', error.message);
  }
}

export async function runControlledAsk(sb: SupabaseClient, body: AskBody): Promise<ControlledAskOutcome> {
  const q = body.question.trim();

  const qa = await matchApprovedQaPool(sb, q);
  if (qa) {
    return { kind: 'qa_pool', row: qa };
  }

  const tc = await matchTrustedContent(sb, q);
  if (tc) {
    return {
      kind: 'trusted_content',
      row: { ...tc, tags: tc.tags ?? [] },
    };
  }

  const { id } = await enqueueLegalReview(sb, q);
  return { kind: 'under_review', queueId: id };
}

/**
 * Safety gate: only these payloads may leave POST /ask.
 * Anything else is a programmer error → blocked (500), never synthetic legal text.
 */
export function outcomeToWireResponse(outcome: ControlledAskOutcome): WireVerifiedAskResponse {
  if (outcome.kind === 'qa_pool') {
    return {
      status: 'ok',
      source: 'qa_pool',
      answer: outcome.row.answer,
      source_detail: outcome.row.source,
      qa_pool_id: outcome.row.id,
    };
  }
  if (outcome.kind === 'trusted_content') {
    return {
      status: 'ok',
      source: 'trusted_content',
      content: outcome.row.content,
      title: outcome.row.title,
      source_detail: outcome.row.source,
      trusted_content_id: outcome.row.id,
    };
  }
  return { status: 'under_review' };
}

export function wireResponseMeta(
  body: WireVerifiedAskResponse
): { source_used: string | null; response_type: ResponseType } {
  if (body.status === 'under_review') {
    return { source_used: null, response_type: 'under_review' };
  }
  if (body.source === 'qa_pool') {
    return { source_used: 'qa_pool', response_type: 'approved_pool' };
  }
  return { source_used: 'trusted_content', response_type: 'trusted_extract' };
}

export function assertWirePayloadIsVerified(body: unknown): asserts body is WireVerifiedAskResponse {
  if (!body || typeof body !== 'object') throw new Error('SAFETY_GATE: invalid body');
  const b = body as Record<string, unknown>;
  if (b.status === 'under_review') {
    const keys = Object.keys(b);
    if (keys.length !== 1 || keys[0] !== 'status') {
      throw new Error('SAFETY_GATE: under_review must be exactly { status: "under_review" }');
    }
    return;
  }
  if (b.status !== 'ok') throw new Error('SAFETY_GATE: unknown status');
  if (b.source === 'qa_pool') {
    if (typeof b.answer !== 'string' || !b.answer.trim()) throw new Error('SAFETY_GATE: qa_pool answer');
    if (typeof b.source_detail !== 'string') throw new Error('SAFETY_GATE: qa_pool source_detail');
    if (typeof b.qa_pool_id !== 'string') throw new Error('SAFETY_GATE: qa_pool id');
    return;
  }
  if (b.source === 'trusted_content') {
    if (typeof b.content !== 'string' || !b.content.trim()) throw new Error('SAFETY_GATE: trusted content');
    if (typeof b.title !== 'string') throw new Error('SAFETY_GATE: trusted title');
    if (typeof b.source_detail !== 'string') throw new Error('SAFETY_GATE: trusted source_detail');
    if (typeof b.trusted_content_id !== 'string') throw new Error('SAFETY_GATE: trusted id');
    return;
  }
  throw new Error('SAFETY_GATE: forbidden payload');
}

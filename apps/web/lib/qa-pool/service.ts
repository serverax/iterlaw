import { getServiceSupabase } from '@/lib/supabase/client';
import type { UserAnswer } from '@/lib/validation/types';
import { computeContentHash, normaliseQuestion } from '@/lib/qa-pool/content-hash';
import type { PersistResult } from '@/types';

export interface QAPoolHit {
  answer: UserAnswer;
  source: 'cache';
}

export async function findCachedUserAnswer(
  question: string,
  jurisdiction: string
): Promise<QAPoolHit | null> {
  const sb = getServiceSupabase();
  if (!sb) return null;

  const content_hash = computeContentHash(question, jurisdiction);
  const { data, error } = await sb
    .from('qa_pool_entries')
    .select('answer')
    .eq('content_hash', content_hash)
    .eq('jurisdiction', jurisdiction)
    .maybeSingle();

  if (error || !data?.answer) return null;

  const answer = data.answer as UserAnswer;
  return { answer: { ...answer, cached: true }, source: 'cache' };
}

export async function upsertCachedUserAnswer(input: {
  question: string;
  jurisdiction: string;
  answer: UserAnswer;
  answerSource: 'gov' | 'ai';
}): Promise<PersistResult> {
  const sb = getServiceSupabase();
  if (!sb) return { ok: true, skipped: true };

  const content_hash = computeContentHash(input.question, input.jurisdiction);
  const question_text = normaliseQuestion(input.question);

  const { error } = await sb.from('qa_pool_entries').upsert(
    {
      jurisdiction: input.jurisdiction,
      content_hash,
      question_text,
      answer: { ...input.answer, cached: true },
      source: input.answerSource,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'content_hash,jurisdiction' }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

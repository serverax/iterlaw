import { getServiceSupabase } from '@/lib/supabase/client';
import type { PersistResult } from '@/types';

export type AnswerCostLayer = 'cache' | 'gov' | 'acas' | 'ai' | 'escalate';

export async function logAnswerCostEvent(input: {
  layer: AnswerCostLayer;
  estCostGbp: number;
  contentHash?: string;
  jurisdiction?: string;
  meta?: Record<string, unknown>;
}): Promise<PersistResult> {
  const sb = getServiceSupabase();
  if (!sb) return { ok: true, skipped: true };

  const { error } = await sb.from('answer_cost_logs').insert({
    layer: input.layer,
    est_cost_gbp: input.estCostGbp,
    content_hash: input.contentHash ?? null,
    jurisdiction: input.jurisdiction ?? null,
    meta: input.meta ?? null,
    occurred_at: new Date().toISOString(),
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Read-only helpers for `review_audit_log` (Supabase). Inserts are performed in {@link reviewQueueService}.
 */
export async function listAuditEntriesForPool(
  sb: SupabaseClient,
  qa_pool_entry_id: string
): Promise<unknown[]> {
  const { data, error } = await sb
    .from('review_audit_log')
    .select('*')
    .eq('qa_pool_entry_id', qa_pool_entry_id)
    .order('reviewed_at', { ascending: false });

  if (error) {
    throw new Error(`review_audit_log: ${error.message}`);
  }
  return data ?? [];
}

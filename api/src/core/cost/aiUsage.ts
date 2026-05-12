import type { SupabaseClient } from '@supabase/supabase-js';
import type { CallerRole, CostControlConfig } from '@iterlaw/shared';
import { dailyAiLimitForRole } from '@iterlaw/shared';

export async function tryConsumeDailyAiCredit(
  sb: SupabaseClient,
  userId: string,
  role: CallerRole,
  config: CostControlConfig,
): Promise<{ allowed: boolean; limit: number; rpcError?: string }> {
  const limit = dailyAiLimitForRole(role, config);
  const { data, error } = await sb.rpc('try_consume_ai_usage', {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) {
    return { allowed: false, limit, rpcError: error.message };
  }
  return { allowed: Boolean(data), limit };
}

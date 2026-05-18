import cron from 'node-cron';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';

const logger = new Logger('QACacheExpiry');

const memoryExpiry = new Map<string, number>();

export async function enforceQACacheExpiry(sb?: SupabaseClient): Promise<number> {
  if (sb) {
    const { data, error } = await sb
      .from('qa_database')
      .update({ is_active: false, deactivated_at: new Date().toISOString() })
      .lt('expires_at', new Date().toISOString())
      .eq('is_active', true)
      .select('id');
    if (error) {
      logger.warn('Supabase QA expiry skipped', { message: error.message });
    } else if (data?.length) {
      logger.info(`[QA Expiry] Marked ${data.length} records as expired`);
      return data.length;
    }
  }

  const now = Date.now();
  let removed = 0;
  for (const [id, expiresAt] of memoryExpiry) {
    if (expiresAt <= now) {
      memoryExpiry.delete(id);
      removed += 1;
    }
  }
  return removed;
}

export function scheduleQACacheExpiry(sb?: SupabaseClient): void {
  cron.schedule('0 2 * * *', () => {
    void enforceQACacheExpiry(sb);
  });
  logger.info('QA cache expiry scheduled (daily at 02:00)');
}

export function setMemoryCacheExpiry(qaRecordId: string, expiresAt: Date): void {
  memoryExpiry.set(qaRecordId, expiresAt.getTime());
}

export async function checkAndEnforceExpiry(
  qaRecordId: string,
  sb?: SupabaseClient
): Promise<boolean> {
  if (sb) {
    const { data } = await sb
      .from('qa_database')
      .select('expires_at,is_active')
      .eq('id', qaRecordId)
      .single();
    if (!data) return false;
    if (data.is_active && new Date(String(data.expires_at)) < new Date()) {
      await sb.from('qa_database').update({ is_active: false }).eq('id', qaRecordId);
      return false;
    }
    return Boolean(data.is_active);
  }

  const expiresAt = memoryExpiry.get(qaRecordId);
  if (!expiresAt) return true;
  if (expiresAt <= Date.now()) {
    memoryExpiry.delete(qaRecordId);
    return false;
  }
  return true;
}

export function purgeExpiredCacheEntries(): number {
  const now = Date.now();
  let removed = 0;
  for (const [id, expiresAt] of memoryExpiry) {
    if (expiresAt <= now) {
      memoryExpiry.delete(id);
      removed += 1;
    }
  }
  return removed;
}

export function startQaCacheExpirySweep(intervalMs = 30_000): NodeJS.Timeout {
  return setInterval(() => {
    purgeExpiredCacheEntries();
  }, intervalMs);
}

/**
 * Safety gate — same rules as legacy Express service: approved pool row + trusted source URL + LVC verified review row.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type CanServeAnswerResult = {
  canServe: boolean;
  reason: string;
};

const APPROVED_DECISIONS = new Set(['approved', 'approved_with_disclaimer']);

type AllowedHost = { host: string; exactOnly: boolean };

const TRUSTED_SOURCE_HOSTS: AllowedHost[] = [
  { host: 'legislation.gov.uk', exactOnly: false },
  { host: 'judiciary.uk', exactOnly: false },
  { host: 'acas.org.uk', exactOnly: false },
  { host: 'gov.uk', exactOnly: false },
];

function isHostnameTrusted(hostname: string): boolean {
  const h = hostname.toLowerCase();
  for (const { host, exactOnly } of TRUSTED_SOURCE_HOSTS) {
    if (exactOnly) {
      if (h === host) return true;
    } else if (h === host || h.endsWith(`.${host}`)) {
      return true;
    }
  }
  return false;
}

function isTrustedSourceUrl(urlString: string): boolean {
  try {
    const u = new URL(urlString);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return isHostnameTrusted(u.hostname);
  } catch {
    return false;
  }
}

function extractSourceUrlFromAnswer(answer: unknown): string | null {
  if (!answer || typeof answer !== 'object') return null;
  const root = answer as Record<string, unknown>;
  const source = root.source;
  if (!source || typeof source !== 'object') return null;
  const url = (source as Record<string, unknown>).url;
  if (typeof url !== 'string') return null;
  const t = url.trim();
  return t.length > 0 ? t : null;
}

export async function canServeAnswer(sb: SupabaseClient, answerId: string): Promise<CanServeAnswerResult> {
  const { data, error } = await sb
    .from('qa_pool_entries')
    .select('legal_reviewer_approved, is_active, decision, expires_at, answer')
    .eq('id', answerId)
    .maybeSingle();

  if (error) {
    return { canServe: false, reason: `read_failed: ${error.message}` };
  }
  if (!data) {
    return { canServe: false, reason: 'answer_not_found' };
  }

  const row = data as {
    legal_reviewer_approved: boolean | null;
    is_active: boolean | null;
    decision: string | null;
    expires_at: string | null;
    answer: unknown;
  };

  if (row.legal_reviewer_approved !== true) {
    return { canServe: false, reason: 'legal_reviewer_not_approved' };
  }

  if (row.is_active !== true) {
    return { canServe: false, reason: 'not_active' };
  }

  const decision = row.decision ?? '';
  if (!APPROVED_DECISIONS.has(decision)) {
    return { canServe: false, reason: `decision_not_approved: ${decision || 'null'}` };
  }

  if (row.expires_at) {
    const exp = new Date(row.expires_at).getTime();
    if (!Number.isFinite(exp) || exp <= Date.now()) {
      return { canServe: false, reason: 'expired' };
    }
  }

  const sourceUrl = extractSourceUrlFromAnswer(row.answer);
  if (!sourceUrl) {
    return { canServe: false, reason: 'missing_source_url' };
  }
  if (!isTrustedSourceUrl(sourceUrl)) {
    return { canServe: false, reason: 'source_url_not_trusted' };
  }

  const { data: reviewRow, error: reviewErr } = await sb
    .from('review_queue')
    .select('lvc_status')
    .eq('qa_pool_entry_id', answerId)
    .in('status', ['approved', 'approved_with_disclaimer'])
    .order('review_completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reviewErr) {
    return { canServe: false, reason: `review_queue_read_failed: ${reviewErr.message}` };
  }
  if (!reviewRow) {
    return { canServe: false, reason: 'missing_approved_review_queue_row' };
  }

  const lvc = (reviewRow as { lvc_status?: string | null }).lvc_status;
  if (lvc !== 'verified') {
    return { canServe: false, reason: `lvc_not_verified:${lvc ?? 'null'}` };
  }

  return { canServe: true, reason: 'ok' };
}

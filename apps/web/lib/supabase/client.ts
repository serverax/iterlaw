import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AxiomTrace, DocumentDraft, LegalFact, PersistResult } from '@/types';

function getUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
}

function getServiceKey(): string | undefined {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY)?.trim();
}

export function getServiceSupabase(): SupabaseClient | null {
  const url = getUrl();
  const key = getServiceKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function saveFacts(caseId: string, facts: LegalFact[]): Promise<PersistResult> {
  const sb = getServiceSupabase();
  if (!sb) return { ok: true, skipped: true };

  const { error } = await sb.from('axiom_facts').upsert(
    facts.map((f) => ({
      case_id: caseId,
      fact_id: f.id,
      label: f.label,
      value: f.value,
      confidence: f.confidence,
      source_span: f.sourceSpan ?? null,
      user_confirmed: f.userConfirmed ?? false,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'case_id,fact_id' }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function saveReasoning(caseId: string, trace: AxiomTrace): Promise<PersistResult> {
  const sb = getServiceSupabase();
  if (!sb) return { ok: true, skipped: true };

  const { error } = await sb.from('axiom_traces').upsert(
    {
      case_id: caseId,
      merit_score: trace.meritScore,
      jurisdiction: trace.jurisdiction,
      steps: trace.steps,
      generated_at: trace.generatedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'case_id' }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function saveDocuments(caseId: string, doc: DocumentDraft): Promise<PersistResult> {
  const sb = getServiceSupabase();
  if (!sb) return { ok: true, skipped: true };

  const { error } = await sb.from('axiom_documents').upsert(
    {
      case_id: caseId,
      document_id: doc.id,
      title: doc.title,
      body: doc.body,
      format: doc.format,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'case_id,document_id' }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

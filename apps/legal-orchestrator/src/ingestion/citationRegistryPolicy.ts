// Sprint 20 — Citation registry policy (foundation).
//
// Pure-function check that an ingestion candidate carries the metadata fields
// IterLaw requires for an answer to cite it: source_url, source_title, a
// verified-at timestamp, and (for legal sources) an effective date.
//
// No network. No DB. No external LLM. No mutation.

export interface CitationCandidateMetadata {
  readonly source_url?: string | null;
  readonly source_title?: string | null;
  readonly retrieved_at?: string | null;
  readonly verified_at?: string | null;
  readonly effective_from?: string | null;
  readonly effective_to?: string | null;
  readonly is_legal_source?: boolean;
}

export type CitationPolicyOutcome =
  | { ok: true; level: "fully_cited" | "needs_review" }
  | { ok: false; reasons: ReadonlyArray<string> };

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

export function evaluateCitationMetadata(
  meta: CitationCandidateMetadata,
): CitationPolicyOutcome {
  const reasons: string[] = [];
  if (!nonEmpty(meta.source_url)) reasons.push("missing_source_url");
  if (!nonEmpty(meta.source_title)) reasons.push("missing_source_title");
  if (!nonEmpty(meta.retrieved_at) && !nonEmpty(meta.verified_at)) {
    reasons.push("missing_retrieved_or_verified_timestamp");
  }
  if (reasons.length > 0) {
    return { ok: false, reasons };
  }
  // Legal sources additionally need an effective date.
  if (meta.is_legal_source) {
    if (!nonEmpty(meta.effective_from) && !nonEmpty(meta.effective_to)) {
      return { ok: true, level: "needs_review" };
    }
  }
  return { ok: true, level: "fully_cited" };
}

// Sprint 24 — Evidence pack types.
//
// An evidence pack is the structured, machine-checkable record of the
// citations that ground a legal answer. The orchestrator emits one per
// answer that passes the citation gates. UI / audit consumers read it.
//
// Pure types only. No runtime imports.

export type CitationStatus =
  | "fully_cited"
  | "needs_review"
  | "blocked_stale"
  | "blocked_low_trust"
  | "blocked_no_source"
  | "blocked_no_citation"
  | "blocked_quote_not_supported"
  | "blocked_chunk_not_found";

export interface EvidencePackEntry {
  readonly source_id: string;
  readonly source_title: string | null;
  readonly source_url: string | null;
  readonly source_type: string;
  readonly effective_from: string | null;
  readonly effective_to: string | null;
  readonly trust_score: number;
  readonly chunk_id: string;
  readonly claim_supported: boolean;
  readonly citation_status: CitationStatus;
  readonly warnings: ReadonlyArray<string>;
  readonly reason_codes: ReadonlyArray<string>;
}

export interface EvidencePack {
  readonly entries: ReadonlyArray<EvidencePackEntry>;
  readonly overallStatus: CitationStatus;
  readonly historicalMode: boolean;
  readonly reasonCodes: ReadonlyArray<string>;
}

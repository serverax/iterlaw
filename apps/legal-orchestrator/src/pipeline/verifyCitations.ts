// Citation verifier interface + minimal implementation (Phase 14, narrowed).
// The real verifier (Phase 14 full) will check chunk_id existence against the DB
// and quote-text containment. This skeleton only enforces the structural rule:
// no citations -> fail.

import type { Citation, RagChunk } from "../types/legal.js";

export interface CitationVerifier {
  verify(input: {
    answer: string;
    sources: RagChunk[];
    declaredCitations?: Citation[];
  }): Promise<{ pass: boolean; citations: Citation[]; failures: string[] }>;
}

export class StructuralCitationVerifier implements CitationVerifier {
  async verify(input: {
    answer: string;
    sources: RagChunk[];
    declaredCitations?: Citation[];
  }): Promise<{ pass: boolean; citations: Citation[]; failures: string[] }> {
    const declared = input.declaredCitations ?? [];
    const failures: string[] = [];

    if (declared.length === 0) {
      // Even structurally — if the answer claims legal positions but cites nothing,
      // reject. The presence-of-citations rule is non-negotiable.
      failures.push("citation_missing");
      return { pass: false, citations: [], failures };
    }

    const allowedChunkIds = new Set(input.sources.map((s) => s.chunk_id));
    const verified: Citation[] = [];

    for (const c of declared) {
      if (!allowedChunkIds.has(c.chunk_id)) {
        failures.push(`chunk_not_found:${c.chunk_id}`);
        continue;
      }
      if (c.quote_text) {
        const src = input.sources.find((s) => s.chunk_id === c.chunk_id);
        if (src && !src.chunk_text.includes(c.quote_text)) {
          failures.push(`quote_not_supported:${c.chunk_id}`);
          continue;
        }
      }
      verified.push(c);
    }

    return { pass: failures.length === 0 && verified.length > 0, citations: verified, failures };
  }
}

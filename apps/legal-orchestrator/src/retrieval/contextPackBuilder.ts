// Sprint 19 — Context pack builder.
//
// Takes the final filtered candidates and produces a deterministic, ordered
// context pack ready for downstream synthesis. This is a thin builder — full
// context compression is handled by `apps/legal-orchestrator/src/intelligence/contextCompressor.ts`.

import type { RetrievalCandidate } from "../intelligence/intelligence.types";

export interface ContextPackEntry {
  readonly candidateId: string;
  readonly sourceTitle: string | null;
  readonly sourceUrl: string | null;
  readonly snippet: string;
  readonly authorityLevel: number | null;
}

export interface ContextPack {
  readonly entries: ReadonlyArray<ContextPackEntry>;
  readonly count: number;
  readonly reasonCodes: ReadonlyArray<string>;
}

const DEFAULT_SNIPPET_CHARS = 1200;

export function buildContextPack(
  candidates: ReadonlyArray<RetrievalCandidate>,
  options: { maxEntries?: number; maxSnippetChars?: number } = {},
): ContextPack {
  const maxEntries = options.maxEntries ?? candidates.length;
  const maxSnippetChars = options.maxSnippetChars ?? DEFAULT_SNIPPET_CHARS;
  const slice = candidates.slice(0, maxEntries);
  const entries: ContextPackEntry[] = slice.map((c) => ({
    candidateId: c.candidate_id,
    sourceTitle: c.source_title ?? null,
    sourceUrl: c.source_url ?? null,
    snippet: c.text.slice(0, maxSnippetChars),
    authorityLevel: typeof c.authority_level === "number" ? c.authority_level : null,
  }));
  return {
    entries,
    count: entries.length,
    reasonCodes: [`context_pack_entries:${entries.length}`],
  };
}

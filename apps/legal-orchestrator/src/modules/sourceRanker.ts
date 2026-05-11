// sourceRanker — reorders RAG hits by a composite of authority,
// keyword overlap with the query, and recency.
//
// Score ranges 0..1. Higher is better. The ranker is stable: ties are
// broken by authority_level then by chunk_id (lexicographic) for
// deterministic test output.

import type {
  SourceRankerInput,
  SourceRankerOutput,
  SourceRankerResult,
} from "./contracts";

const SOURCE_TYPE_BASE: Record<string, number> = {
  legislation: 1.0,
  statutory_instrument: 0.95,
  appeal_case: 0.85,
  tribunal_case: 0.7,
  acas_guidance: 0.6,
  gov_guidance: 0.5,
  internal_note: 0.3,
  template: 0.2,
  case_law: 0.7,
};

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3); // drop stop-tokens crudely
}

function keywordOverlap(query: string, chunk: string): number {
  const qTok = new Set(tokenize(query));
  if (qTok.size === 0) return 0;
  const cTok = new Set(tokenize(chunk));
  let hit = 0;
  for (const t of qTok) if (cTok.has(t)) hit++;
  return hit / qTok.size; // 0..1
}

function recencyScore(effective_date?: string, now: Date = new Date()): number {
  if (!effective_date) return 0.5; // neutral
  const d = new Date(effective_date);
  if (isNaN(d.getTime())) return 0.5;
  const ageDays = Math.max(0, (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  // Half-life ~5 years. After 10 years score≈0.25.
  return Math.exp(-ageDays / 1825);
}

export function sourceRanker(input: SourceRankerInput): SourceRankerOutput {
  const now = new Date();
  const scored = input.results.map((r) => {
    const sourceBase = SOURCE_TYPE_BASE[r.source_type] ?? 0.3;
    // Normalise authority 0..100 → 0..1 then blend.
    const authority = Math.max(0, Math.min(100, r.authority_level)) / 100;
    const overlap = keywordOverlap(input.query, r.chunk_text + " " + r.title);
    const recency = recencyScore(r.effective_date, now);

    // Weights: authority dominates, keyword overlap is the differentiator,
    // recency is a tie-breaker. Sum bounded 0..1.
    const composite =
      0.55 * Math.max(authority, sourceBase) + 0.30 * overlap + 0.15 * recency;

    return { ...r, ranker_score: Math.max(0, Math.min(1, composite)) };
  });

  scored.sort((a, b) => {
    if (b.ranker_score !== a.ranker_score) return b.ranker_score - a.ranker_score;
    if (b.authority_level !== a.authority_level) return b.authority_level - a.authority_level;
    return a.chunk_id.localeCompare(b.chunk_id);
  });

  return { ranked_results: scored };
}

export type { SourceRankerResult };

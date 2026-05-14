// Sprint 23 — Deterministic reranker (foundation).
//
// Pure function. No external reranker model. No LLM. No network. No DB.
//
// Reorders a list of `RetrievalCandidate` records by a weighted sum of
// deterministic signals already present on each candidate. The score is
// returned alongside the reordered list so the caller can record it in the
// decision trace.
//
// Wiring: this function is NOT invoked unless the caller explicitly opts in
// (typically via `ITERLAW_RERANKER_ENABLED=true`). The multi-tier retrieval
// gateway can compose this in front of the final candidate set without
// changing any other tier.

import type { RetrievalCandidate, RetrievalSource } from "../intelligence/intelligence.types";

export interface RerankerWeights {
  /** Coefficient for trust contribution (default 1.0). */
  readonly trust: number;
  /** Coefficient for freshness contribution (default 1.0). */
  readonly freshness: number;
  /** Coefficient for exact-match boost (default 1.0). */
  readonly exactMatchBoost: number;
  /** Coefficient for source-tier contribution (default 1.0). */
  readonly sourceTier: number;
  /** Coefficient for jurisdiction match (default 1.0). */
  readonly jurisdictionMatch: number;
  /** Coefficient for law-area match (default 1.0). */
  readonly lawAreaMatch: number;
  /** Coefficient for citation metadata completeness (default 1.0). */
  readonly citationMetadata: number;
  /** Subtractive coefficient for stale candidates (default 1.0). */
  readonly stalePenalty: number;
  /** Subtractive coefficient for low-trust candidates (default 1.0). */
  readonly lowTrustPenalty: number;
}

export const DEFAULT_RERANKER_WEIGHTS: RerankerWeights = {
  trust: 1.0,
  freshness: 1.0,
  exactMatchBoost: 1.0,
  sourceTier: 1.0,
  jurisdictionMatch: 1.0,
  lawAreaMatch: 1.0,
  citationMetadata: 1.0,
  stalePenalty: 1.0,
  lowTrustPenalty: 1.0,
};

export interface RerankerContext {
  /** ISO date the reranker treats as "now". */
  readonly nowIsoDate: string;
  /** Optional jurisdiction hint to bias matches. */
  readonly jurisdiction?: string;
  /** Optional law area hint to bias matches. */
  readonly lawArea?: string;
  /**
   * Optional set of `candidate_id`s the upstream exact-match tier marked
   * as approved Q&A hits. Those receive an exact-match boost.
   */
  readonly exactMatchCandidateIds?: ReadonlySet<string>;
}

export interface RerankerScore {
  readonly candidate_id: string;
  readonly score: number;
  readonly components: {
    readonly trust: number;
    readonly freshness: number;
    readonly exactMatchBoost: number;
    readonly sourceTier: number;
    readonly jurisdictionMatch: number;
    readonly lawAreaMatch: number;
    readonly citationMetadata: number;
    readonly stalePenalty: number;
    readonly lowTrustPenalty: number;
  };
  readonly reasonCodes: ReadonlyArray<string>;
}

export interface RerankerOutcome {
  readonly ordered: ReadonlyArray<RetrievalCandidate>;
  readonly scores: ReadonlyArray<RerankerScore>;
}

const SOURCE_TIER_RANK: Record<RetrievalSource, number> = {
  statutory_source: 1.0,
  govuk_guidance: 0.7,
  acas_guidance: 0.7,
  tribunal_case: 0.85,
  project_memory: 0.5,
  sprint_report: 0.4,
  approved_output: 0.6,
  architecture_decision: 0.5,
  user_uploaded_document: 0.55,
  draft_ai_output: 0.3,
};

function trustComponent(c: RetrievalCandidate): number {
  if (c.qa_status === "approved") return 1.0;
  if (c.qa_status === "draft" || c.qa_status === "unreviewed") return 0.5;
  if (c.qa_status === "failed") return 0.0;
  return 0.7;
}

function freshnessComponent(c: RetrievalCandidate, nowIso: string): number {
  // Effective-to in the past → 0; otherwise the candidate is fresh.
  if (c.effective_to && c.effective_to < nowIso.slice(0, 10)) return 0;
  if (c.superseded_by) return 0;
  return 1.0;
}

function isStale(c: RetrievalCandidate, nowIso: string): boolean {
  if (c.superseded_by) return true;
  if (c.effective_to && c.effective_to < nowIso.slice(0, 10)) return true;
  return false;
}

function citationMetadataComponent(c: RetrievalCandidate): number {
  let n = 0;
  if (c.source_url && c.source_url.length > 0) n += 1;
  if (c.source_title && c.source_title.length > 0) n += 1;
  if (c.effective_from && c.effective_from.length > 0) n += 1;
  if (c.last_verified_at && c.last_verified_at.length > 0) n += 1;
  return n / 4;
}

function sourceTierComponent(c: RetrievalCandidate): number {
  return SOURCE_TIER_RANK[c.source_type] ?? 0.3;
}

export function rerankCandidates(
  candidates: ReadonlyArray<RetrievalCandidate>,
  ctx: RerankerContext,
  weights: RerankerWeights = DEFAULT_RERANKER_WEIGHTS,
): RerankerOutcome {
  const scores: RerankerScore[] = candidates.map((c) => {
    const reasonCodes: string[] = [];
    const trust = trustComponent(c);
    if (trust === 0) reasonCodes.push("reranker:failed_qa_zero_trust");

    const freshness = freshnessComponent(c, ctx.nowIsoDate);
    const stale = isStale(c, ctx.nowIsoDate);
    if (stale) reasonCodes.push("reranker:stale");

    const exactMatchBoost =
      ctx.exactMatchCandidateIds && ctx.exactMatchCandidateIds.has(c.candidate_id) ? 1.0 : 0;
    if (exactMatchBoost > 0) reasonCodes.push("reranker:exact_match");

    const sourceTier = sourceTierComponent(c);
    const jurisdictionMatch = ctx.jurisdiction
      ? // The candidate doesn't carry jurisdiction directly; we approximate by
        // checking the source_url for the jurisdiction hint.
        c.source_url && c.source_url.toLowerCase().includes(ctx.jurisdiction.toLowerCase().split("_")[0] ?? "")
        ? 1.0
        : 0
      : 0;
    if (jurisdictionMatch > 0) reasonCodes.push("reranker:jurisdiction_match");

    const lawAreaMatch = ctx.lawArea
      ? c.source_title && c.source_title.toLowerCase().includes(ctx.lawArea.toLowerCase())
        ? 1.0
        : 0
      : 0;
    if (lawAreaMatch > 0) reasonCodes.push("reranker:law_area_match");

    const citationMetadata = citationMetadataComponent(c);
    if (citationMetadata < 0.5) reasonCodes.push("reranker:weak_citation_metadata");

    const stalePenalty = stale ? 1 : 0;
    const lowTrustPenalty = trust < 0.5 ? 1 : 0;
    if (lowTrustPenalty > 0) reasonCodes.push("reranker:low_trust");

    const score =
      weights.trust * trust +
      weights.freshness * freshness +
      weights.exactMatchBoost * exactMatchBoost +
      weights.sourceTier * sourceTier +
      weights.jurisdictionMatch * jurisdictionMatch +
      weights.lawAreaMatch * lawAreaMatch +
      weights.citationMetadata * citationMetadata -
      weights.stalePenalty * stalePenalty -
      weights.lowTrustPenalty * lowTrustPenalty;

    return {
      candidate_id: c.candidate_id,
      score,
      components: {
        trust,
        freshness,
        exactMatchBoost,
        sourceTier,
        jurisdictionMatch,
        lawAreaMatch,
        citationMetadata,
        stalePenalty,
        lowTrustPenalty,
      },
      reasonCodes,
    };
  });

  // Stable sort by score desc; ties preserve original order.
  const order = scores
    .map((s, idx) => ({ s, idx }))
    .sort((a, b) => {
      if (b.s.score !== a.s.score) return b.s.score - a.s.score;
      return a.idx - b.idx;
    });

  const ordered = order.map((entry) => candidates[entry.idx]!);
  const sortedScores = order.map((entry) => entry.s);

  return { ordered, scores: sortedScores };
}

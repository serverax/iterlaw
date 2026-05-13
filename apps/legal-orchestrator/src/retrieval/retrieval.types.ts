// Sprint 19 — Multi-tier retrieval types.
//
// This layer composes existing intelligence-layer primitives (RetrievalCandidate,
// RRF fusion, trust scoring, freshness filtering) into a tier-aware orchestration
// plan. The tier names below are stable identifiers used in decision traces.
//
// Pure types only. No runtime imports.

import type {
  RetrievalCandidate,
  HybridRetrievalResult,
  QueryIntent,
} from "../intelligence/intelligence.types";

export type TierName =
  | "exact_approved_qa"      // 1. exact approved Q&A / answer cache
  | "rules_lookup"           // 2. deterministic legal rules lookup
  | "full_text"              // 3. BM25-style keyword
  | "vector"                 // 4. pgvector semantic
  | "fused_full_text_vector" // result of RRF over (full_text + vector)
  | "rerank_placeholder"     // 9. reranker (interface only; not implemented in this sprint)
  | "compressed_context";    // 10. compressed context pack

export type RetrievalTierStatus =
  | "selected"
  | "skipped"
  | "no_results"
  | "blocked_by_trust"
  | "blocked_by_freshness"
  | "blocked_by_metadata"
  | "error";

export interface MetadataFilter {
  /** Required jurisdiction (e.g. "UK_ENGLAND_WALES"). */
  readonly jurisdiction?: string;
  /** Required law area (e.g. "employment"). */
  readonly lawArea?: string;
  /** Minimum source-tier rank (1 = primary legislation). Candidates below this are excluded. */
  readonly minSourceTier?: number;
  /** Reject candidates whose `effective_to` is before this ISO date (default = now). */
  readonly effectiveAtIsoDate?: string;
  /** When true, allow superseded / stale candidates with a warning reason code. */
  readonly historicalMode?: boolean;
}

export interface MultiTierPlan {
  readonly intent: QueryIntent;
  readonly tiers: ReadonlyArray<TierName>;
  readonly metadataFilter: MetadataFilter;
  readonly maxFinalCandidates: number;
  /** Decision trace for why this plan was chosen. */
  readonly reasonCodes: ReadonlyArray<string>;
}

export interface TierResult {
  readonly tier: TierName;
  readonly status: RetrievalTierStatus;
  readonly candidates: ReadonlyArray<RetrievalCandidate>;
  readonly reasonCodes: ReadonlyArray<string>;
}

export interface MultiTierResult {
  readonly plan: MultiTierPlan;
  readonly tierResults: ReadonlyArray<TierResult>;
  /** Final, deduplicated, trust-filtered, freshness-filtered candidates in order. */
  readonly finalCandidates: ReadonlyArray<RetrievalCandidate>;
  /** RRF fusion result for full_text + vector tiers (may be empty). */
  readonly fusion?: HybridRetrievalResult;
  readonly excludedByTrust: ReadonlyArray<string>;
  readonly excludedByFreshness: ReadonlyArray<string>;
  readonly excludedByMetadata: ReadonlyArray<string>;
  readonly decisionTrace: ReadonlyArray<string>;
}

export interface ExactApprovedHit {
  readonly canonicalQuestion: string;
  readonly answerSummary: string;
  readonly candidate: RetrievalCandidate;
}

export interface RulesLookupHit {
  readonly ruleId: string;
  readonly ruleLabel: string;
  readonly candidate: RetrievalCandidate;
}

export type RetrievalQueryType =
  | "legal_rules_calculation"   // redundancy, NMW, notice, limitation
  | "legal_question"
  | "historical_comparison"
  | "unknown";

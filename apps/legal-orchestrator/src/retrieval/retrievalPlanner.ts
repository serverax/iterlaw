// Sprint 19 — Multi-tier retrieval planner & executor.
//
// Deterministic. Pure. No DB. No network. No external LLM. The actual data
// sources are injected via the `dependencies` argument; without them the
// planner returns empty results with explicit reason codes.

import type {
  HybridRetrievalResult,
  RetrievalCandidate,
} from "../intelligence/intelligence.types";
import type {
  MetadataFilter,
  MultiTierPlan,
  MultiTierResult,
  RetrievalQueryType,
  TierName,
  TierResult,
} from "./retrieval.types";
import { applyMetadataFilter } from "./metadataFilter";
import { applyTrustFilter } from "./retrievalTrustFilter";
import { applyFreshnessFilter } from "./retrievalFreshnessFilter";
import { fuseRrf } from "./rrfFusion";
import { runExactMatchTier, type ExactApprovedLookup } from "./exactMatchTier";
import { runRulesLookupTier, type RulesLookup } from "./rulesLookupTier";
import { runFullTextTier, type FullTextSearch } from "./fullTextTier";
import { runVectorTier, type VectorSearch } from "./vectorTier";

export interface PlannerDependencies {
  readonly exactApprovedLookup?: ExactApprovedLookup;
  readonly rulesLookup?: RulesLookup;
  readonly fullTextSearch?: FullTextSearch;
  readonly vectorSearch?: VectorSearch;
}

export interface PlannerRequest {
  readonly question: string;
  readonly queryType: RetrievalQueryType;
  readonly metadataFilter?: MetadataFilter;
  readonly maxFinalCandidates?: number;
  readonly nowIsoDate?: string;
  readonly minTrustScore?: number;
}

function classifyTiers(queryType: RetrievalQueryType): {
  tiers: ReadonlyArray<TierName>;
  reasons: string[];
} {
  switch (queryType) {
    case "legal_rules_calculation":
      return {
        tiers: ["exact_approved_qa", "rules_lookup", "full_text", "vector", "fused_full_text_vector", "compressed_context"],
        reasons: ["query_type:legal_rules_calculation", "tiers:rules_first"],
      };
    case "historical_comparison":
      return {
        tiers: ["exact_approved_qa", "full_text", "vector", "fused_full_text_vector", "compressed_context"],
        reasons: ["query_type:historical_comparison", "tiers:historical_mode"],
      };
    case "legal_question":
      return {
        tiers: ["exact_approved_qa", "full_text", "vector", "fused_full_text_vector", "compressed_context"],
        reasons: ["query_type:legal_question", "tiers:fulltext_plus_vector"],
      };
    default:
      return {
        tiers: ["exact_approved_qa", "full_text", "vector", "fused_full_text_vector", "compressed_context"],
        reasons: ["query_type:unknown", "tiers:conservative_default"],
      };
  }
}

export async function planAndExecuteMultiTier(
  request: PlannerRequest,
  deps: PlannerDependencies = {},
): Promise<MultiTierResult> {
  const tierClassification = classifyTiers(request.queryType);
  const historicalMode = request.queryType === "historical_comparison";
  const metadataFilter: MetadataFilter = {
    ...(request.metadataFilter ?? {}),
    historicalMode: historicalMode || !!request.metadataFilter?.historicalMode,
  };
  const plan: MultiTierPlan = {
    intent: "legal_question",
    tiers: tierClassification.tiers,
    metadataFilter,
    maxFinalCandidates: request.maxFinalCandidates ?? 8,
    reasonCodes: tierClassification.reasons,
  };

  const decisionTrace: string[] = [...plan.reasonCodes];
  const tierResults: TierResult[] = [];

  // Tier 1: exact approved Q&A
  const exact = await runExactMatchTier(request.question, deps.exactApprovedLookup);
  tierResults.push(exact);
  decisionTrace.push(`tier:exact_approved_qa:${exact.status}`);

  // If an exact approved match exists, it outranks everything else and we
  // short-circuit. The other tiers are still recorded as "skipped" so the
  // decision trace stays complete.
  if (exact.status === "selected" && exact.candidates.length > 0) {
    for (const t of plan.tiers) {
      if (t === "exact_approved_qa") continue;
      tierResults.push({ tier: t, status: "skipped", candidates: [], reasonCodes: ["short_circuit_by_exact_match"] });
    }
    const finalCandidates = exact.candidates.slice(0, plan.maxFinalCandidates);
    decisionTrace.push("short_circuit:exact_approved_qa");
    return {
      plan,
      tierResults,
      finalCandidates,
      excludedByTrust: [],
      excludedByFreshness: [],
      excludedByMetadata: [],
      decisionTrace,
    };
  }

  // Tier 2: rules lookup (only when query type is legal_rules_calculation)
  let rulesTier: TierResult | null = null;
  if (request.queryType === "legal_rules_calculation") {
    rulesTier = await runRulesLookupTier(request.question, deps.rulesLookup);
    tierResults.push(rulesTier);
    decisionTrace.push(`tier:rules_lookup:${rulesTier.status}`);
  }

  // Tier 3 + 4: full text + vector
  const fullText = await runFullTextTier(
    request.question,
    { limit: plan.maxFinalCandidates * 3 },
    deps.fullTextSearch,
  );
  tierResults.push(fullText);
  decisionTrace.push(`tier:full_text:${fullText.status}`);

  const vector = await runVectorTier(
    request.question,
    { limit: plan.maxFinalCandidates * 3 },
    deps.vectorSearch,
  );
  tierResults.push(vector);
  decisionTrace.push(`tier:vector:${vector.status}`);

  const combinedFulltextVector: ReadonlyArray<RetrievalCandidate> = [
    ...fullText.candidates,
    ...vector.candidates,
  ];

  // RRF fusion
  const fused = fuseRrf(combinedFulltextVector);
  const fusion: HybridRetrievalResult = {
    candidates: fused.candidates as RetrievalCandidate[],
    rrf_scores: fused.scores,
    per_source_counts: {
      full_text: fullText.candidates.length,
      vector: vector.candidates.length,
    },
    dedup_count: fused.dedupCount,
    reason_codes: ["rrf_fused_full_text_and_vector"],
  };
  tierResults.push({
    tier: "fused_full_text_vector",
    status: fused.candidates.length > 0 ? "selected" : "no_results",
    candidates: fused.candidates,
    reasonCodes: [`fused_count:${fused.candidates.length}`, `dedup:${fused.dedupCount}`],
  });
  decisionTrace.push(`tier:fused_full_text_vector:${fused.candidates.length > 0 ? "selected" : "no_results"}`);

  // Combine rules + fused output (rules first when present)
  const preFilter: ReadonlyArray<RetrievalCandidate> = [
    ...(rulesTier?.candidates ?? []),
    ...fused.candidates,
  ];

  // Apply metadata filter
  const metadataOutcome = applyMetadataFilter(preFilter, metadataFilter);

  // Apply trust filter
  const trustOutcome = applyTrustFilter(metadataOutcome.accepted, request.minTrustScore ?? 60);

  // Apply freshness filter
  const freshnessOutcome = applyFreshnessFilter(trustOutcome.accepted, {
    historicalMode,
    nowIsoDate: request.nowIsoDate,
  });

  const finalCandidates: RetrievalCandidate[] = freshnessOutcome.accepted.slice(0, plan.maxFinalCandidates);
  decisionTrace.push(
    `metadata_rejected:${metadataOutcome.rejected.length}`,
    `trust_rejected:${trustOutcome.rejected.length}`,
    `freshness_rejected:${freshnessOutcome.rejected.length}`,
    `historical_kept:${freshnessOutcome.historicalKept.length}`,
    `final_count:${finalCandidates.length}`,
  );

  return {
    plan,
    tierResults,
    finalCandidates,
    fusion,
    excludedByTrust: trustOutcome.rejected.map((r) => r.id),
    excludedByFreshness: freshnessOutcome.rejected.map((r) => r.id),
    excludedByMetadata: metadataOutcome.rejected.map((r) => r.id),
    decisionTrace,
  };
}

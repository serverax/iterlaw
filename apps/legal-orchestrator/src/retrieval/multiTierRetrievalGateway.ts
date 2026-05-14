// Sprint 19A — Multi-Tier Retrieval Gateway.
// Sprint 28 — applies the deterministic reranker behind
// `ITERLAW_RERANKER_ENABLED` (default OFF) over the final candidate set.
//
// Adapter that wraps `planAndExecuteMultiTier` for `handleLegalRequest`.
// When the `ITERLAW_MULTI_TIER_RETRIEVAL_ENABLED` flag is OFF, this function
// is not invoked (the caller guards on the flag).
//
// When ON without injected dependencies, every tier returns "skipped" or
// "no_results" and the decision trace is captured. No network, no DB, no
// external LLM, no behaviour change to the legal answer path.

import { planAndExecuteMultiTier } from "./retrievalPlanner";
import type { PlannerDependencies, PlannerRequest } from "./retrievalPlanner";
import type { RetrievalCandidate } from "../intelligence/intelligence.types";
import type { MultiTierResult, RetrievalQueryType } from "./retrieval.types";
import { getRerankerConfig } from "../config/featureFlags";
import { rerankCandidates } from "./reranker";

export interface MultiTierRetrievalGatewayInput {
  readonly question: string;
  readonly queryType: RetrievalQueryType;
  readonly deps?: PlannerDependencies;
  readonly maxFinalCandidates?: number;
  readonly nowIsoDate?: string;
}

export interface MultiTierRetrievalGatewayResult {
  readonly finalCandidates: ReadonlyArray<RetrievalCandidate>;
  readonly decisionTrace: ReadonlyArray<string>;
  readonly hadCandidates: boolean;
  readonly insufficientSources: boolean;
}

export async function runMultiTierRetrievalGateway(
  input: MultiTierRetrievalGatewayInput,
): Promise<MultiTierRetrievalGatewayResult> {
  const request: PlannerRequest = {
    question: input.question,
    queryType: input.queryType,
    maxFinalCandidates: input.maxFinalCandidates,
    nowIsoDate: input.nowIsoDate,
  };
  let result: MultiTierResult;
  try {
    result = await planAndExecuteMultiTier(request, input.deps ?? {});
  } catch (err) {
    return {
      finalCandidates: [],
      decisionTrace: [
        "multi_tier_gateway:exception",
        `multi_tier_gateway:error:${err instanceof Error ? err.name : "unknown"}`,
      ],
      hadCandidates: false,
      insufficientSources: true,
    };
  }
  // Sprint 28 — optionally apply the deterministic reranker to the final set.
  let finalCandidates: ReadonlyArray<RetrievalCandidate> = result.finalCandidates;
  const rerankerTrace: string[] = [];
  const rerankerConfig = getRerankerConfig();
  if (rerankerConfig.enabled && finalCandidates.length > 1) {
    try {
      const reranked = rerankCandidates(finalCandidates, {
        nowIsoDate: input.nowIsoDate ?? new Date().toISOString().slice(0, 10),
      });
      finalCandidates = reranked.ordered;
      rerankerTrace.push("reranker_gateway:applied", `reranker_gateway:count:${finalCandidates.length}`);
    } catch (err) {
      rerankerTrace.push(
        "reranker_gateway:error",
        `reranker_gateway:error_name:${err instanceof Error ? err.name : "unknown"}`,
      );
      // Fall through with the original ordering.
    }
  } else if (rerankerConfig.enabled) {
    rerankerTrace.push("reranker_gateway:skipped:not_enough_candidates");
  }

  const hadCandidates = finalCandidates.length > 0;
  return {
    finalCandidates,
    decisionTrace: [
      "multi_tier_gateway:entered",
      ...result.decisionTrace,
      `multi_tier_gateway:final_count:${finalCandidates.length}`,
      ...rerankerTrace,
    ],
    hadCandidates,
    insufficientSources: !hadCandidates,
  };
}

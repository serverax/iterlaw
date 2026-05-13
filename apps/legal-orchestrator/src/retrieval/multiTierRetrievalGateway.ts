// Sprint 19A — Multi-Tier Retrieval Gateway.
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
  const hadCandidates = result.finalCandidates.length > 0;
  return {
    finalCandidates: result.finalCandidates,
    decisionTrace: [
      "multi_tier_gateway:entered",
      ...result.decisionTrace,
      `multi_tier_gateway:final_count:${result.finalCandidates.length}`,
    ],
    hadCandidates,
    insufficientSources: !hadCandidates,
  };
}

// Sprint 19A — Multi-Tier Retrieval Gateway.
// Sprint 28 — applies the deterministic reranker behind
// `ITERLAW_RERANKER_ENABLED` (default OFF) over the final candidate set.
// Sprint 36 — wires the Sprint 32 pgvector adapter behind
// `ITERLAW_PGVECTOR_GATEWAY_ENABLED` (default OFF) into the planner's
// `vectorSearch` slot. The caller's explicit `deps.vectorSearch` always
// wins; pgvector is used only when the slot is empty AND the flag is ON
// AND both a `PgvectorClient` and an embedder were supplied.
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
import { getRerankerConfig, getPgvectorGatewayConfig } from "../config/featureFlags";
import { rerankCandidates } from "./reranker";
import {
  createPgvectorSearchFromEmbedder,
  type PgvectorClient,
  type QuestionToEmbedding,
} from "./pgvectorSearchAdapter";

export interface MultiTierRetrievalGatewayInput {
  readonly question: string;
  readonly queryType: RetrievalQueryType;
  readonly deps?: PlannerDependencies;
  readonly maxFinalCandidates?: number;
  readonly nowIsoDate?: string;
  /**
   * Sprint 36 — optional pgvector wiring dependencies. Only consulted when
   * `ITERLAW_PGVECTOR_GATEWAY_ENABLED=true` AND `deps.vectorSearch` is not
   * already populated.
   */
  readonly pgvector?: {
    readonly client?: PgvectorClient;
    readonly embedder?: QuestionToEmbedding;
  };
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
  // Sprint 36 — resolve pgvector wiring (default OFF).
  const pgvectorTrace: string[] = [];
  let effectiveDeps: PlannerDependencies = input.deps ?? {};
  const pgvectorConfig = getPgvectorGatewayConfig();
  if (pgvectorConfig.enabled) {
    if (effectiveDeps.vectorSearch) {
      pgvectorTrace.push("pgvector_gateway:skipped:caller_supplied_vector_search");
    } else if (!input.pgvector?.client || !input.pgvector?.embedder) {
      pgvectorTrace.push("pgvector_gateway:no_dependencies");
    } else {
      try {
        const vectorSearch = createPgvectorSearchFromEmbedder(
          input.pgvector.client,
          input.pgvector.embedder,
        );
        effectiveDeps = { ...effectiveDeps, vectorSearch };
        pgvectorTrace.push("pgvector_gateway:wired");
      } catch (err) {
        pgvectorTrace.push(
          "pgvector_gateway:wire_error",
          `pgvector_gateway:error_name:${err instanceof Error ? err.name : "unknown"}`,
        );
      }
    }
  }

  const request: PlannerRequest = {
    question: input.question,
    queryType: input.queryType,
    maxFinalCandidates: input.maxFinalCandidates,
    nowIsoDate: input.nowIsoDate,
  };
  let result: MultiTierResult;
  try {
    result = await planAndExecuteMultiTier(request, effectiveDeps);
  } catch (err) {
    return {
      finalCandidates: [],
      decisionTrace: [
        "multi_tier_gateway:exception",
        `multi_tier_gateway:error:${err instanceof Error ? err.name : "unknown"}`,
        ...pgvectorTrace,
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
      ...pgvectorTrace,
      ...result.decisionTrace,
      `multi_tier_gateway:final_count:${finalCandidates.length}`,
      ...rerankerTrace,
    ],
    hadCandidates,
    insufficientSources: !hadCandidates,
  };
}

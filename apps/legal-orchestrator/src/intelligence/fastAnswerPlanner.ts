// Fast Legal Answer Engine — deterministic decision function.
//
// `planFastLegalAnswer` is the bouncer at the door of the LLM queue.
// It consumes a structured input (already-classified question + facts +
// optional cache and prepared-answer hints) and returns one of five
// `FastAnswerMode` decisions, with an explainable `reason`.
//
// Hard guarantees:
//   * Pure function: no `fetch`, no `pg`, no `process.env`, no
//     `Date.now()` or `Math.random()` reads anywhere in this file.
//   * No throws for control flow — invalid input is reported as
//     `missing_facts`.
//   * Deterministic given input — the same input produces the same
//     output across processes.

import type {
  FastAnswerInput,
  FastAnswerResult,
  LegalLlmJob,
  ModelRoutingDecision,
  MotherBrainDecision,
} from "./fastAnswer.types";

// ---------------------------------------------------------------------
// Tuning knobs — all const, no env reads.
// ---------------------------------------------------------------------

/** Above this complexity_score the planner escalates to `deep_analysis`. */
const DEEP_ANALYSIS_COMPLEXITY_THRESHOLD = 0.7;

/** A complexity_score absent on input is treated as this mid value. */
const DEFAULT_COMPLEXITY_SCORE = 0.3;

/** Area-of-law specific required facts. The planner refuses to compose
 *  an answer without these. */
const REQUIRED_FACTS_BY_AREA: Record<string, ReadonlyArray<keyof FastAnswerInput["facts"]>> = {
  unfair_dismissal: ["dismissal_date"],
  redundancy: ["dismissal_date"],
  discrimination: ["incident_date"],
  whistleblowing: ["incident_date"],
};

// ---------------------------------------------------------------------
// Routing helpers.
// ---------------------------------------------------------------------

function ttlForRole(role: LegalLlmJob["role"]): number {
  // Deterministic per-role cache TTLs. Drafting outputs change less
  // often than synthesis outputs because they tend to be templated.
  switch (role) {
    case "uk_employment_drafting":
      return 7 * 24 * 3600;
    case "uk_employment_document":
      return 24 * 3600;
    case "heavy_reasoning":
      return 24 * 3600;
    case "uk_employment_qa":
    default:
      return 6 * 3600;
  }
}

function priorityForRisk(
  risk: FastAnswerInput["risk"]
): LegalLlmJob["priority"] {
  if (risk.status === "high_risk_deadline" && risk.risk_level === "critical") return "urgent";
  if (risk.status === "high_risk_deadline") return "high";
  if (risk.risk_level === "high") return "high";
  return "normal";
}

function maxTokensForRole(role: LegalLlmJob["role"]): number {
  switch (role) {
    case "uk_employment_drafting":
      return 2000;
    case "uk_employment_document":
      return 1600;
    case "heavy_reasoning":
      return 2400;
    case "uk_employment_qa":
    default:
      return 1200;
  }
}

function buildRouting(
  role: LegalLlmJob["role"],
  priority: LegalLlmJob["priority"],
  promptBundleId: string
): ModelRoutingDecision {
  return {
    role,
    cache_ttl_s: ttlForRole(role),
    priority,
    max_tokens: maxTokensForRole(role),
    prompt_bundle_id: promptBundleId,
  };
}

function buildLlmJob(
  input: FastAnswerInput,
  routing: ModelRoutingDecision,
  chunkIds?: string[]
): Omit<LegalLlmJob, "id"> {
  return {
    task_fingerprint: input.question_fingerprint + "::" + input.facts_fingerprint,
    role: routing.role,
    prompt_bundle_id: routing.prompt_bundle_id,
    chunk_ids: chunkIds,
    priority: routing.priority,
    max_tokens: routing.max_tokens,
  };
}

function pickRoleForMode(
  questionMode: FastAnswerInput["question_mode"],
  complexity: number
): LegalLlmJob["role"] {
  if (complexity >= DEEP_ANALYSIS_COMPLEXITY_THRESHOLD) return "heavy_reasoning";
  switch (questionMode) {
    case "draft":
      return "uk_employment_drafting";
    case "document_review":
      return "uk_employment_document";
    case "deadline":
    case "risk":
    case "ask":
    default:
      return "uk_employment_qa";
  }
}

function pickPromptBundleId(
  questionMode: FastAnswerInput["question_mode"],
  areaOfLaw: string
): string {
  return `${questionMode}.${areaOfLaw}.v1`;
}

// ---------------------------------------------------------------------
// Decision construction helpers.
// ---------------------------------------------------------------------

function instantFromCache(input: FastAnswerInput, reason: string): FastAnswerResult {
  const cache = input.cache_hit!;
  const decision: MotherBrainDecision = {
    mode: "instant_prepared",
    reason,
    synthesis_required: false,
  };
  return {
    request_id: input.request_id,
    decision,
    answer_source: { kind: "cache", cache_id: cache.id, expires_at: cache.expires_at },
  };
}

function instantFromBlock(input: FastAnswerInput, reason: string): FastAnswerResult {
  const block = input.prepared_block!;
  const decision: MotherBrainDecision = {
    mode: "instant_prepared",
    reason,
    synthesis_required: false,
  };
  return {
    request_id: input.request_id,
    decision,
    answer_source: {
      kind: "prepared_block",
      block_id: block.id,
      scenario_key: block.scenario_key,
    },
  };
}

function missing(input: FastAnswerInput, missingFacts: string[], reason: string): FastAnswerResult {
  return {
    request_id: input.request_id,
    decision: {
      mode: "missing_facts",
      reason,
      synthesis_required: false,
    },
    missing_facts: missingFacts,
  };
}

function ragGrounded(input: FastAnswerInput, reason: string): FastAnswerResult {
  const role: LegalLlmJob["role"] = "uk_employment_qa";
  const priority = priorityForRisk(input.risk);
  const promptBundleId = pickPromptBundleId(input.question_mode, input.classification.area_of_law);
  const routing = buildRouting(role, priority, promptBundleId);
  return {
    request_id: input.request_id,
    decision: {
      mode: "rag_grounded",
      reason,
      synthesis_required: true,
      llm_job: buildLlmJob(input, routing),
      routing,
    },
  };
}

function llmComposed(
  input: FastAnswerInput,
  reason: string,
  role: LegalLlmJob["role"]
): FastAnswerResult {
  const priority = priorityForRisk(input.risk);
  const promptBundleId = pickPromptBundleId(input.question_mode, input.classification.area_of_law);
  const routing = buildRouting(role, priority, promptBundleId);
  return {
    request_id: input.request_id,
    decision: {
      mode: "llm_composed",
      reason,
      synthesis_required: true,
      llm_job: buildLlmJob(input, routing),
      routing,
    },
  };
}

function deepAnalysis(input: FastAnswerInput, reason: string): FastAnswerResult {
  const role: LegalLlmJob["role"] = "heavy_reasoning";
  // Deep analysis always carries the highest priority short of the
  // urgent deadline class.
  const priority: LegalLlmJob["priority"] =
    input.risk.status === "high_risk_deadline" ? "urgent" : "high";
  const promptBundleId = pickPromptBundleId(input.question_mode, input.classification.area_of_law);
  const routing = buildRouting(role, priority, promptBundleId);
  return {
    request_id: input.request_id,
    decision: {
      mode: "deep_analysis",
      reason,
      synthesis_required: true,
      llm_job: buildLlmJob(input, routing),
      routing,
    },
  };
}

// ---------------------------------------------------------------------
// The planner.
// ---------------------------------------------------------------------

export function planFastLegalAnswer(input: FastAnswerInput): FastAnswerResult {
  // 1. Structural validity — the orchestrator should never let an
  //    incomplete classification reach the planner, but we degrade
  //    gracefully rather than throw.
  if (
    !input.classification.jurisdiction ||
    input.classification.jurisdiction.trim().length === 0
  ) {
    return missing(input, ["jurisdiction"], "classification_missing_jurisdiction");
  }

  // 2. Risk short-circuit. If the upstream risk check says the user
  //    is missing facts, the planner must surface that — never silently
  //    fall through to RAG or LLM composition.
  if (input.risk.status === "needs_more_facts") {
    return missing(
      input,
      input.risk.missing_facts.length > 0 ? input.risk.missing_facts : ["facts"],
      "risk_check_needs_more_facts"
    );
  }

  // 3. Area-of-law specific required facts. The planner adds these on
  //    top of `risk.missing_facts` so a caller that has not yet wired
  //    the risk module still gets safe behaviour.
  const required = REQUIRED_FACTS_BY_AREA[input.classification.area_of_law] ?? [];
  const missingForArea: string[] = [];
  for (const k of required) {
    const v = input.facts[k];
    if (v === undefined || v === null || v === "") missingForArea.push(k);
  }
  if (missingForArea.length > 0) {
    return missing(input, missingForArea, "area_required_facts_missing");
  }

  // 4. Cache hit — the hottest path. We do NOT call the cache here;
  //    the orchestrator already looked it up. If the row is supplied,
  //    we trust the caller's freshness check.
  if (input.cache_hit) {
    return instantFromCache(
      input,
      `cache_hit:${input.cache_hit.id.slice(0, 8)}`
    );
  }

  // 5. Prepared answer block — operator-curated template covering this
  //    scenario_key + jurisdiction. Same trust contract: the caller
  //    looked it up; the planner just routes.
  if (input.prepared_block) {
    return instantFromBlock(
      input,
      `prepared_block:${input.prepared_block.scenario_key}`
    );
  }

  // 6. High-risk deadline. Even when no prepared block exists, we route
  //    these as `deep_analysis` so the synthesis-worker uses the
  //    heavier model with urgent priority. Acceptable because volume
  //    is low and the user is at real legal jeopardy.
  if (input.risk.status === "high_risk_deadline") {
    return deepAnalysis(input, "high_risk_deadline_urgent");
  }

  // 7. Complexity-based escalation. Document review or any question
  //    flagged as complex by the classifier (>= 0.7) goes to deep.
  const complexity =
    typeof input.classification.complexity_score === "number"
      ? input.classification.complexity_score
      : DEFAULT_COMPLEXITY_SCORE;

  if (input.question_mode === "document_review") {
    return deepAnalysis(input, "document_review_mode");
  }

  if (complexity >= DEEP_ANALYSIS_COMPLEXITY_THRESHOLD) {
    return deepAnalysis(input, `complexity_score=${complexity}`);
  }

  // 8. Drafting tasks have their own role even at low complexity.
  if (input.question_mode === "draft") {
    return llmComposed(input, "drafting_mode", "uk_employment_drafting");
  }

  // 9. Default. If RAG is expected to produce chunks we ground on those;
  //    otherwise we still queue an LLM job but flag the absence of a
  //    chunk-supported context.
  const ragExpected = input.rag_expected_to_return_chunks ?? true;
  if (ragExpected) {
    return ragGrounded(input, "rag_default_route");
  }

  return llmComposed(input, "rag_unavailable_llm_fallback", pickRoleForMode(input.question_mode, complexity));
}

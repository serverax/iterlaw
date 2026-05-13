// Sprint 14 — Retrieval planner. Given a QueryIntent, return a
// deterministic ordered list of sources to query. Pure function.

import type {
  QueryIntent,
  RetrievalPlan,
  RetrievalSource,
  RetrievalStrategy,
} from "./intelligence.types";

interface PlanRule {
  sources: RetrievalSource[];
  strategy: RetrievalStrategy;
  must_include_legal_temporal: boolean;
}

const PLANS: Record<QueryIntent, PlanRule> = {
  legal_question: {
    sources: ["statutory_source", "govuk_guidance", "acas_guidance", "tribunal_case"],
    strategy: "statutory_first",
    must_include_legal_temporal: true,
  },
  compliance: {
    sources: ["statutory_source", "govuk_guidance", "architecture_decision"],
    strategy: "statutory_first",
    must_include_legal_temporal: true,
  },
  project_status: {
    sources: ["sprint_report", "project_memory", "approved_output"],
    strategy: "project_memory_first",
    must_include_legal_temporal: false,
  },
  technical_architecture: {
    sources: ["architecture_decision", "sprint_report", "approved_output"],
    strategy: "architecture_first",
    must_include_legal_temporal: false,
  },
  security_risk: {
    sources: ["architecture_decision", "approved_output", "sprint_report"],
    strategy: "architecture_first",
    must_include_legal_temporal: false,
  },
  deployment: {
    sources: ["architecture_decision", "sprint_report", "approved_output"],
    strategy: "architecture_first",
    must_include_legal_temporal: false,
  },
  billing_or_pricing: {
    sources: ["approved_output", "architecture_decision"],
    strategy: "approved_outputs_first",
    must_include_legal_temporal: false,
  },
  customer_support: {
    sources: ["approved_output", "project_memory"],
    strategy: "approved_outputs_first",
    must_include_legal_temporal: false,
  },
  code_generation: {
    sources: ["architecture_decision", "approved_output", "project_memory"],
    strategy: "architecture_first",
    must_include_legal_temporal: false,
  },
  unknown: {
    sources: ["approved_output"],
    strategy: "conservative_unknown",
    must_include_legal_temporal: false,
  },
};

export function planRetrieval(intent: QueryIntent, maxCandidatesPerSource = 8): RetrievalPlan {
  const rule = PLANS[intent];
  const reason_codes: string[] = [
    `plan_for_intent:${intent}`,
    `strategy:${rule.strategy}`,
    `sources:${rule.sources.join(",")}`,
  ];
  if (rule.must_include_legal_temporal) {
    reason_codes.push("legal_temporal_required");
  }
  if (intent === "unknown") {
    reason_codes.push("conservative_retrieval_due_to_unknown_intent");
  }
  return {
    intent,
    sources_priority: rule.sources,
    strategy: rule.strategy,
    max_candidates_per_source: maxCandidatesPerSource,
    must_include_legal_temporal: rule.must_include_legal_temporal,
    reason_codes,
  };
}

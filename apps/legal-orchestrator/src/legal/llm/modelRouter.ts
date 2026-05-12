// Pure routing function. No I/O. Selects a local Ollama tag for a
// given task, refusing legal drafting when there are no retrieved
// chunks (citation-required rule).
//
// IterLaw model routing never returns a public-provider model — the
// `LocalModelTag` union enforces that at the type level.

import type { ModelRouteDecision, ModelRouteRequest } from "./llm.types";

export function routeModel(req: ModelRouteRequest): ModelRouteDecision {
  switch (req.task) {
    case "legal_drafting":
      if (!req.hasRetrievedChunks) {
        return { ok: false, reason: "refused_no_citations" };
      }
      return { ok: true, model: "uk-employment-qwen:latest" };

    case "drafting_letter":
      if (!req.hasRetrievedChunks) {
        return { ok: false, reason: "refused_no_citations" };
      }
      return { ok: true, model: "uk-employment-drafting:latest" };

    case "document_summary":
      return { ok: true, model: "uk-employment-document:latest" };

    case "small_helper":
    case "classification":
      // Helper tasks (fact extraction, missing-fact prompts, intent
      // classification) reuse the strong model with low temperature
      // at call time. They do NOT require citations because their
      // output is not a legal claim.
      return {
        ok: true,
        model: "uk-employment-qwen:latest",
        reason: "low_resource_helper",
      };

    default: {
      // Exhaustiveness guard — if a new LlmTask is added, fail loudly.
      const _exhaustive: never = req.task;
      void _exhaustive;
      return { ok: false, reason: "unknown_task" };
    }
  }
}

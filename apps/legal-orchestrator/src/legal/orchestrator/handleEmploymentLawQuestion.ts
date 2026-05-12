// handleEmploymentLawQuestion — entry point for the IterLaw fast-answer
// pipeline as specified by the Master Order.
//
// Current sprint behaviour (skeleton):
//   1. Normalise the question (strip, lowercase, single-space).
//   2. Best-effort persist a `rag_runs` row (only if a DbClient is
//      supplied via deps; otherwise the run is not persisted and the
//      response carries `ragRunId: undefined`).
//   3. Return `answerStatus: "insufficient_sources"` with NO fabricated
//      legal answer, no fake citations, and no model call.
//
// Hard rules per Master Order:
//   * No external LLM call.
//   * No invented citations.
//   * No claim that retrieval is wired (because it isn't yet).
//   * Returns a typed `LegalAnswer` envelope.

import type { LegalAnswer } from "../types/legalAnswer.types";
import type { DbClient } from "../repositories/ragRunRepository";
import { createRagRun } from "../repositories/ragRunRepository";

export interface HandleQuestionInput {
  question: string;
  userId?: string;
  jurisdiction?: string;
}

export interface HandleQuestionDeps {
  /** Optional. When omitted, the orchestrator runs in dry-run mode —
   *  the `rag_runs` row is NOT persisted and `ragRunId` is undefined. */
  db?: DbClient;
}

function normalise(question: string): string {
  return question
    .replace(/\s+/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .toLowerCase();
}

export async function handleEmploymentLawQuestion(
  input: HandleQuestionInput,
  deps: HandleQuestionDeps = {}
): Promise<LegalAnswer> {
  const safeJurisdiction =
    typeof input.jurisdiction === "string" && input.jurisdiction.trim().length > 0
      ? input.jurisdiction.trim()
      : "england_wales";

  const normalized = normalise(input.question ?? "");

  let ragRunId: string | undefined;
  try {
    const created = await createRagRun(deps.db, {
      userQuestion: input.question,
      normalizedQuestion: normalized,
      jurisdiction: safeJurisdiction,
      legalArea: "employment",
      issueType: ["unknown"],
      retrievalMode: "none",
    });
    if (created.status === "ok") {
      ragRunId = created.id;
    }
    // DB_NOT_WIRED or validation_error → no ragRunId, no failure. The
    // orchestrator must continue and return the honest "insufficient
    // sources" envelope.
  } catch {
    // Never crash on a DB hiccup at this layer — the user gets a
    // structured "insufficient_sources" answer instead of a 500.
  }

  return {
    answerStatus: "insufficient_sources",
    summary:
      "The IterLaw legal RAG foundation is available, but retrieval and verified source answering are not wired yet.",
    missingFacts: [],
    citations: [],
    practicalSteps: [],
    deadlines: [],
    riskFlags: [],
    confidenceScore: 0,
    sourceQualityScore: 0,
    ragRunId,
  };
}

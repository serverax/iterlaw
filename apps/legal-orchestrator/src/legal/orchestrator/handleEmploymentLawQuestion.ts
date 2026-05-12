// handleEmploymentLawQuestion — entry point for the IterLaw fast-answer
// pipeline.
//
// Pipeline in this sprint:
//   1. Normalise the question (strip, lowercase, single-space).
//   2. Best-effort persist a `rag_runs` row (only when a DbClient is
//      supplied via deps).
//   3. Bridge the request into `planFastLegalAnswer` (deterministic
//      decision module shipped in commit d9cca67).
//   4. Route per planner decision:
//        - missing_facts  → return answerStatus="needs_more_facts"
//        - rag_grounded   → call retrieveLegalContext placeholder;
//                            when retrieval is "not_wired" or empty
//                            return answerStatus="insufficient_sources"
//        - instant_prepared / llm_composed / deep_analysis → return
//                            an honest "insufficient_sources" envelope
//                            because the downstream pipeline is not
//                            wired in this sprint.
//   5. NEVER call an LLM. NEVER fabricate citations. NEVER claim a
//      legal position that did not come from a verified source.

import type { LegalAnswer } from "../types/legalAnswer.types";
import type { DbClient } from "../repositories/ragRunRepository";
import { createRagRun } from "../repositories/ragRunRepository";
import { planFastLegalAnswer } from "../../intelligence/fastAnswerPlanner";
import type { FastAnswerInput } from "../../intelligence/fastAnswer.types";
import { retrieveLegalContext } from "../rag/retrieveLegalContext";

export interface HandleQuestionInput {
  question: string;
  userId?: string;
  jurisdiction?: string;
}

export interface HandleQuestionDeps {
  /** Optional. When omitted the orchestrator runs in dry-run mode —
   *  the `rag_runs` row is NOT persisted and `ragRunId` is undefined. */
  db?: DbClient;
}

function normalise(question: string): string {
  return question
    .replace(/\s+/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .toLowerCase();
}

function fingerprint(s: string): string {
  // Deterministic, audit-safe, no PII echo. Not cryptographic — a
  // simple FNV-1a 32-bit hash rendered hex. The real cache layer will
  // replace this with sha256(question + facts).
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
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
  } catch {
    // Never crash on a DB hiccup at this layer.
  }

  const plannerInput: FastAnswerInput = {
    request_id: ragRunId ?? "no-rag-run",
    legal_pack: "uk_employment_england_wales",
    question_mode: "ask",
    question_fingerprint: fingerprint(normalized),
    facts_fingerprint: fingerprint(""),
    classification: {
      // The orchestrator does not yet classify questions into an
      // area-of-law. Until a classifier is wired, route as "unknown"
      // — the planner's area-required-facts table does not list
      // "unknown", so no fact is mandated by default. A real
      // classifier (next sprint) will replace this.
      area_of_law: "unknown",
      jurisdiction:
        safeJurisdiction === "england_wales" ? "England and Wales" : safeJurisdiction,
      requires_deadline_check: false,
      requires_citations: true,
    },
    // The Master-Order orchestrator does not yet collect structured
    // facts. The planner therefore reports `missing_facts` for areas
    // that require a date — that is intentional, not an error.
    facts: {},
    risk: { status: "ok", risk_level: "low", missing_facts: [] },
    rag_expected_to_return_chunks: true,
  };

  const plan = planFastLegalAnswer(plannerInput);

  if (plan.decision.mode === "missing_facts") {
    return {
      answerStatus: "needs_more_facts",
      summary:
        "More facts are required before a legal position can be drafted. Please supply the missing fields and re-submit.",
      missingFacts: plan.missing_facts ?? [],
      citations: [],
      practicalSteps: [],
      deadlines: [],
      riskFlags: [],
      confidenceScore: 0,
      sourceQualityScore: 0,
      ragRunId,
    };
  }

  if (plan.decision.mode === "rag_grounded") {
    const ctx = await retrieveLegalContext({
      normalizedQuestion: normalized,
      jurisdiction: safeJurisdiction,
    });
    if (ctx.retrievalStatus === "not_wired" || ctx.chunks.length === 0) {
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
    // Belt-and-braces: even if the placeholder is replaced with a
    // real retrieval that returns chunks, this code path does not
    // synthesise an answer (no LLM, no citations the verifier didn't
    // approve). The caller gets honest insufficient_sources until
    // the verifier path is wired.
    return {
      answerStatus: "insufficient_sources",
      summary:
        "Retrieval returned chunks but the citation-aware synthesis path is not yet wired. No legal answer was generated.",
      missingFacts: [],
      citations: [...ctx.citations],
      practicalSteps: [],
      deadlines: [],
      riskFlags: [],
      confidenceScore: 0,
      sourceQualityScore: 0,
      ragRunId,
    };
  }

  // instant_prepared / llm_composed / deep_analysis — pipeline not wired.
  return {
    answerStatus: "insufficient_sources",
    summary:
      `Planner decision mode '${plan.decision.mode}' is recognised but the downstream pipeline is not wired yet. No legal answer was generated.`,
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

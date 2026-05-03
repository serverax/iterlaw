import type { ReviewRequestInput, ArtResult } from "../types/legal.types";
import type { LegalReviewApiResponse } from "../types/review-api.types";
import type { ClaimFamily } from "../reasoning/reasoning.types";
import { runAee } from "../engines/aee.engine";
import { runRiskEngine } from "../engines/risk.engine";
import { runLvcEngine } from "../engines/lvc.engine";
import { logger } from "../utils/logger";
import { logJsonRecord } from "../utils/jsonLog";
import { MockRetrievalService } from "../rag/retrieval.service";
import { runLegalReasoningEngine } from "../reasoning/legal-reasoning.engine";
import { buildCompensationSection } from "../compensation/build-compensation-section";
import { buildSafetyEnvelope } from "../safety/review-safety";

const DEFAULT_MODULE = "employment-law" as const;

const retrievalSvc = new MockRetrievalService();

export interface PipelineContext {
  requestId: string;
}

function ts(): string {
  return new Date().toISOString();
}

function claimLabel(f: ClaimFamily): string {
  switch (f) {
    case "unfair-dismissal":
      return "Unfair dismissal (ERA 1996)";
    case "discrimination":
      return "Discrimination / EqA 2010";
    case "whistleblowing":
      return "Whistleblowing / protected disclosures";
    case "wages":
      return "Wages / unlawful deduction";
    case "redundancy":
      return "Redundancy";
    default:
      return "Unspecified employment claim";
  }
}

/**
 * Legal review: AEE → RAG (mock) → legal reasoning → risk → compensation → LVC → safety.
 */
export async function runLegalReviewPipeline(
  input: ReviewRequestInput,
  ctx: PipelineContext,
): Promise<LegalReviewApiResponse> {
  const { requestId } = ctx;
  const module = input.module ?? DEFAULT_MODULE;

  logJsonRecord({
    level: "info",
    requestId,
    event: "input",
    timestamp: ts(),
    text: input.text,
    module,
    documentsCount: Array.isArray(input.documents) ? input.documents.length : 0,
  });

  logger.info("Pipeline start", { module, requestId });

  const aee = await runAee(input.text, module);
  logJsonRecord({
    level: "info",
    requestId,
    event: "aee_output",
    timestamp: ts(),
    output: aee,
  });

  const queryText = [input.text, ...aee.facts].join("\n");
  const retrieval = await retrievalSvc.retrieve({ queryText, module, topK: 6 });

  const legalReasoning = runLegalReasoningEngine(aee, input.text, module, retrieval);
  logJsonRecord({
    level: "info",
    requestId,
    event: "legal_reasoning_output",
    timestamp: ts(),
    output: legalReasoning,
  });

  const artForRisk: ArtResult = {
    issues: [
      ...legalReasoning.missingElements.slice(0, 5),
      `Claim family (heuristic): ${legalReasoning.claimType}`,
    ],
    legalTests: [legalReasoning.legalTest],
    weaknesses: legalReasoning.claimantWeaknesses,
  };

  const risk = runRiskEngine(aee, artForRisk, input.text, module);
  logJsonRecord({
    level: "info",
    requestId,
    event: "risk_output",
    timestamp: ts(),
    output: risk,
  });

  const compensation = buildCompensationSection(legalReasoning.claimType, input.text);
  logJsonRecord({
    level: "info",
    requestId,
    event: "compensation_output",
    timestamp: ts(),
    output: compensation,
  });

  const lvc = runLvcEngine(artForRisk, risk, module);

  const evidenceGaps = Array.from(
    new Set([...legalReasoning.missingElements, ...legalReasoning.evidenceNeeded]),
  );

  const documentsToGenerate = Array.from(
    new Set([...lvc.documents, ...lvc.suggestedActions, ...lvc.remedies.slice(0, 2)]),
  );

  const safety = buildSafetyEnvelope(legalReasoning.citations, legalReasoning, risk);

  const out: LegalReviewApiResponse = {
    ...safety,
    module,
    facts: aee.facts,
    claims: [{ family: legalReasoning.claimType, label: claimLabel(legalReasoning.claimType) }],
    legalReasoning,
    risk: {
      level: risk.riskLevel,
      score: risk.riskScore,
      reasons: risk.reasons,
      urgentFlags: risk.urgentFlags,
    },
    compensation,
    citations: legalReasoning.citations,
    evidenceGaps,
    nextSteps: lvc.nextSteps,
    documentsToGenerate,
  };

  logJsonRecord({
    level: "info",
    requestId,
    event: "final_output",
    timestamp: ts(),
    output: out,
  });

  logger.info("Pipeline complete", {
    requestId,
    claim: legalReasoning.claimType,
    risk: risk.riskLevel,
  });
  return out;
}

export const legalReviewPipeline = runLegalReviewPipeline;

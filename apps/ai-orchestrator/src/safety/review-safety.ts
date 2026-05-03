import type { RagCitation } from "../rag/rag.types";
import type { LegalReasoningOutput } from "../reasoning/reasoning.types";
import type { RiskResult } from "../types/legal.types";

const DISCLAIMER =
  "IterLaw outputs are litigation-planning aids only. They are not legal advice. A regulated solicitor must review facts, evidence, limitation, and strategy.";

export interface SafetyEnvelope {
  disclaimer: string;
  /** 0–1 heuristic confidence (higher when citations are complete and gaps are fewer). */
  confidenceScore: number;
  safetyFlags: string[];
}

export function buildSafetyEnvelope(
  citations: RagCitation[],
  reasoning: LegalReasoningOutput,
  risk: RiskResult,
): SafetyEnvelope {
  const safetyFlags: string[] = [];

  const uncited = citations.some((c) => c.chunkId === "uncited" || c.sourceId === "uncited");
  if (uncited) {
    safetyFlags.push("uncited_propositions_present");
  }
  safetyFlags.push("citation_required_for_court_submission");

  if (reasoning.missingElements.length >= 4) {
    safetyFlags.push("material_fact_gaps");
  }

  if (risk.riskLevel === "critical" || risk.riskLevel === "high") {
    safetyFlags.push("solicitor_review_recommended");
  }

  let confidenceScore = 0.55;
  if (!uncited) confidenceScore += 0.15;
  confidenceScore -= Math.min(0.25, reasoning.missingElements.length * 0.04);
  if (risk.riskLevel === "critical") confidenceScore -= 0.1;
  confidenceScore = Math.max(0.15, Math.min(0.95, Math.round(confidenceScore * 100) / 100));

  return {
    disclaimer: DISCLAIMER,
    confidenceScore,
    safetyFlags,
  };
}

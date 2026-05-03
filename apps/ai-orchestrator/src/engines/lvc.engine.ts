import type { ArtResult, LawModule, LvcResult, RiskResult } from "../types/legal.types";
import { logger } from "../utils/logger";

/**
 * Legal Value Calculator (LVC) — mock compensation band and action list.
 */
export function runLvcEngine(
  art: ArtResult,
  risk: RiskResult,
  module: LawModule,
): LvcResult {
  logger.info("LVC: valuing", { module, risk: risk.riskLevel });
  const baseLow = module === "employment-law" ? 8000 : 2000;
  const baseHigh = module === "employment-law" ? 45000 : 12000;
  const riskBump = risk.riskScore > 60 ? 5000 : 0;
  const compensationRange = `£${baseLow + riskBump}–£${baseHigh + riskBump} (mock range)`;

  const remedies: string[] = [
    "Early conciliation (ACAS) — information only in mock pipeline.",
    "Subject access request for key documents — mock suggestion.",
  ];
  const documents: string[] = [
    "Contract of employment (if any)",
    "Disciplinary / investigation pack",
    "Payslips and recent correspondence",
  ];
  const suggestedActions: string[] = [
    "Chronology: list key dates and actors.",
    "Preserve emails and messages; avoid selective deletion.",
    ...art.issues.slice(0, 2).map((i) => `Review issue: ${i}`),
  ];
  const nextSteps: string[] = [
    "Confirm jurisdiction (ET time limits — mock reminder).",
    "Gather disclosable documents bundle (mock).",
    "Book advice with a qualified solicitor — required for real cases.",
  ];

  return {
    compensationRange,
    remedies,
    documents,
    suggestedActions,
    nextSteps,
  };
}

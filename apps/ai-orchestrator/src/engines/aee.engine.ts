import type { AeeResult, LawModule } from "../types/legal.types";
import { logger } from "../utils/logger";

/**
 * Advanced Extraction Engine (AEE) — deterministic mock only (Phase 1–3; no OpenRouter).
 */
export function runAeeMock(text: string, module: LawModule): AeeResult {
  logger.info("AEE: mock extraction", { module, chars: text.length });
  const facts: string[] = [];

  facts.push(`Module context: ${module.replace(/-/g, " ")}.`);

  if (/\b(suspend|suspended|suspension)\b/i.test(text)) {
    facts.push("User mentions suspension or suspension-related treatment.");
  }
  if (/\b(notice|dismiss|dismissal|terminate|fired|sack)\b/i.test(text)) {
    facts.push("Employment termination or notice concerns are referenced.");
  }
  if (/\b(evidence|allegation|accusation)\b/i.test(text)) {
    facts.push("Evidence or allegations are part of the narrative.");
  }
  if (/\b(employer|company|manager|hr)\b/i.test(text)) {
    facts.push("Employer-side actors are mentioned.");
  }

  const datesMentioned: string[] = [];
  const dateMatches = text.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g);
  if (dateMatches) {
    datesMentioned.push(...dateMatches);
  }

  const employerGuess = /\bemployer\b/i.test(text) ? "Employer referenced in narrative" : null;
  const employeeRoleGuess = /\bI was\b/i.test(text) ? "First-person employee perspective" : "Unknown role";
  const issueTypeGuess =
    module === "employment-law" ? "Employment dispute (generic)" : `${module} matter (generic)`;

  if (facts.length === 1) {
    facts.push("Narrative captured for downstream legal reasoning (no specialist extraction yet).");
  }

  return {
    facts,
    datesMentioned,
    employerGuess,
    employeeRoleGuess,
    issueTypeGuess,
  };
}

export async function runAee(text: string, module: LawModule): Promise<AeeResult> {
  return runAeeMock(text, module);
}

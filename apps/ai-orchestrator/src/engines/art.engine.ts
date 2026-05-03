import type { AeeResult, ArtResult, LawModule } from "../types/legal.types";
import { logger } from "../utils/logger";

/**
 * ART — deterministic mock only (not used in main pipeline when legal-reasoning runs; kept for tests / legacy).
 */
export function runArtMock(aee: AeeResult, text: string, module: LawModule): ArtResult {
  logger.info("ART: mock reasoning", { module });
  const issues: string[] = [];
  const legalTests: string[] = [];
  const weaknesses: string[] = [];

  if (module === "employment-law") {
    issues.push("Potential breach of implied term of trust and confidence (fact-dependent).");
    issues.push("Whether any suspension was contractual and proportionate.");
    legalTests.push("ERA 1996 — unfair dismissal jurisdiction and qualifying service (mock).");
    legalTests.push("ACAS Code of Practice on disciplinary and grievance procedures (mock).");
    weaknesses.push("Limited documentary evidence referenced in free-text input.");
  } else {
    issues.push(`${module}: generic civil/public-law style issue framing (mock).`);
    legalTests.push("Statutory and policy tests depend on module-specific rules (mock).");
    weaknesses.push("Narrative-only intake; no uploaded pleadings or correspondence.");
  }

  if (/without notice|no notice|immediate/i.test(text)) {
    issues.push("Notice / procedure fairness may be live if dismissal or sanction is alleged.");
  }

  if (aee.facts.some((f) => /suspension/i.test(f))) {
    legalTests.push("Contractual right to suspend vs implied duty of fairness (mock).");
  }

  weaknesses.push("Mock engine: not a substitute for regulated legal advice.");

  return { issues, legalTests, weaknesses };
}

export async function runArt(aee: AeeResult, text: string, module: LawModule): Promise<ArtResult> {
  return runArtMock(aee, text, module);
}

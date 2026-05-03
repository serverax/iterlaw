import type { AeeResult, LawModule } from "../types/legal.types";
import type { ClaimFamily } from "./reasoning.types";

export function detectClaimFamily(text: string, module: LawModule, aee: AeeResult): ClaimFamily {
  if (module !== "employment-law") return "unknown";
  const corpus = [text, ...aee.facts].join("\n").toLowerCase();

  if (
    /\b(discriminat|race|sex|disability|pregnancy|harassment|equal pay|protected characteristic)\b/i.test(
      corpus,
    )
  ) {
    return "discrimination";
  }
  if (/\b(whistleblow|protected disclosure|detriment)\b/i.test(corpus)) {
    return "whistleblowing";
  }
  if (/\b(unpaid wages|deduction|holiday pay|not paid|short pay)\b/i.test(corpus)) {
    return "wages";
  }
  if (/\b(redundan|pool|consultation|at risk)\b/i.test(corpus)) {
    return "redundancy";
  }
  if (
    /\b(dismissed?|dismissal|sacked|fired|terminated|termination|constructive dismissal)\b/i.test(corpus)
  ) {
    return "unfair-dismissal";
  }
  return "unknown";
}

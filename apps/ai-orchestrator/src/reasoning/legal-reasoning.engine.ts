/**
 * Tribunal-level legal reasoning — deterministic scaffold + RAG citations only.
 */

import type { AeeResult, LawModule } from "../types/legal.types";
import type { RetrievalResult } from "../rag/rag.types";
import type { LegalReasoningOutput, ClaimFamily } from "./reasoning.types";
import { markUncited, mergeCitations } from "../rag/citation.service";
import { assessBurchellFromText } from "./burchell.engine";
import { assessAcasCode } from "./acas-code.engine";
import { assessLimitationUrgency } from "./limitation.engine";
import { assessEvidenceWeight } from "./evidence-weight.engine";
import { detectClaimFamily } from "./claim-detection";
import { unfairDismissalElements } from "./tribunal-tests/unfair-dismissal.test";
import { discriminationElements } from "./tribunal-tests/discrimination.test";
import { whistleblowingElements } from "./tribunal-tests/whistleblowing.test";
import { wagesElements } from "./tribunal-tests/wages.test";
import { redundancyElements } from "./tribunal-tests/redundancy.test";

function elementsForClaim(f: ClaimFamily): readonly string[] {
  switch (f) {
    case "unfair-dismissal":
      return unfairDismissalElements;
    case "discrimination":
      return discriminationElements;
    case "whistleblowing":
      return whistleblowingElements;
    case "wages":
      return wagesElements;
    case "redundancy":
      return redundancyElements;
    default:
      return ["Jurisdiction", "Merits", "Remedy", "Time limits"] as const;
  }
}

function legalTestLabel(f: ClaimFamily): string {
  switch (f) {
    case "unfair-dismissal":
      return "ERA 1996 — ss.94–98 unfair dismissal reasonableness and potentially fair reasons";
    case "discrimination":
      return "Equality Act 2010 — prohibited conduct and justification frameworks";
    case "whistleblowing":
      return "ERA 1996 — protected disclosures and detriment / dismissal";
    case "wages":
      return "ERA 1996 Part II — unlawful deduction from wages (where applicable)";
    case "redundancy":
      return "ERA 1996 — redundancy fairness, consultation, and selection";
    default:
      return "Module-specific statutory tests (not inferred)";
  }
}

export function runLegalReasoningEngine(
  aee: AeeResult,
  text: string,
  module: LawModule,
  retrieval: RetrievalResult,
): LegalReasoningOutput {
  const claimFamily = detectClaimFamily(text, module, aee);
  const template = [...elementsForClaim(claimFamily)];

  const burchell = assessBurchellFromText(text);
  const acas = assessAcasCode(text);
  const lim = assessLimitationUrgency(text);
  const ev = assessEvidenceWeight(text);

  const satisfiedElements: string[] = [];
  const missingElements: string[] = [];
  const evidenceNeeded: string[] = [
    "Contract of employment and any variation letters",
    "Key correspondence and investigation / hearing records",
    "Payslips and payment records where compensation claimed",
  ];
  const employerDefences: string[] = [];
  const claimantWeaknesses: string[] = [...ev.notes];

  if (claimFamily === "unfair-dismissal") {
    employerDefences.push("Potentially fair reason and reasonable response band under s.98(4) ERA 1996.");
    if (/\b(investigation|hearing|disciplinary|minutes|meeting)\b/i.test(text)) {
      satisfiedElements.push("Some procedural steps are described — depth and fairness still fact-specific.");
    }
    if (burchell.reasonableInvestigation === "weak") {
      missingElements.push("Clear account of investigation steps, witnesses interviewed, and findings.");
    } else if (burchell.reasonableInvestigation === "likely") {
      satisfiedElements.push("Investigation/hearing narrative present — Burchell stage not ruled against employee on text alone.");
    } else {
      satisfiedElements.push("Investigation quality not fully evidenced in free text.");
    }
    if (acas.alignedWithCode === "unlikely") {
      missingElements.push(...acas.proceduralGaps.map((g) => `ACAS / procedure: ${g}`));
    } else {
      satisfiedElements.push("ACAS Code alignment not ruled out on current text alone.");
    }
    claimantWeaknesses.push(...burchell.notes);
  } else if (claimFamily === "discrimination") {
    employerDefences.push("Legitimate aim / proportionality (indirect) or non-discriminatory explanation (direct) may be advanced.");
    missingElements.push("Comparator / pool and timeline of detriments often fact-heavy.");
  } else if (claimFamily === "unknown") {
    missingElements.push(...template.slice(0, 3));
  }

  if (lim.urgentEtLimitation) {
    missingElements.push("Limitation / primary time limit triage (urgent — solicitor input).");
  }

  let tribunalRisk: LegalReasoningOutput["tribunalRisk"] = "medium";
  if (claimFamily === "discrimination") {
    tribunalRisk = "high";
  } else if (ev.documentarySupport === "weak" && acas.alignedWithCode === "unlikely") {
    tribunalRisk = "high";
  } else if (lim.urgentEtLimitation) {
    tribunalRisk = "high";
  }

  const reasoningSummary = [
    `Primary claim family (heuristic): ${claimFamily}.`,
    `Legal test framing: ${legalTestLabel(claimFamily)}.`,
    `Burchell investigation posture: ${burchell.reasonableInvestigation}. ACAS Code alignment (heuristic): ${acas.alignedWithCode}.`,
    `Evidence documentary strength: ${ev.documentarySupport}.`,
    lim.notes.length ? lim.notes.join(" ") : "",
  ]
    .filter(Boolean)
    .join(" ");

  const baseCitations = mergeCitations(retrieval.citations, []);
  const withFallback =
    baseCitations.length > 0
      ? baseCitations
      : [markUncited("No retrieval match — legal propositions are uncited pending knowledge base ingestion.")];

  return {
    claimType: claimFamily,
    legalTest: legalTestLabel(claimFamily),
    satisfiedElements,
    missingElements,
    evidenceNeeded,
    employerDefences,
    claimantWeaknesses,
    tribunalRisk,
    reasoningSummary,
    citations: withFallback,
  };
}

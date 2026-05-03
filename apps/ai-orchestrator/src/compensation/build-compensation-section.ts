import type { ClaimFamily } from "../reasoning/reasoning.types";
import type { CompensationEstimateOutput } from "./compensation.types";
import { inferUnfairDismissalInputsFromText } from "./input-hints";
import { buildUnfairDismissalCompensation } from "./unfair-dismissal-aggregate";
import { estimateInjuryToFeelingsBand } from "./discrimination-injury.calculator";

export function buildCompensationSection(
  claimFamily: ClaimFamily,
  text: string,
): CompensationEstimateOutput {
  if (claimFamily === "unfair-dismissal") {
    const inputs = inferUnfairDismissalInputsFromText(text);
    return buildUnfairDismissalCompensation(inputs);
  }

  const assumptions = [`Compensation aggregate not modelled for claim family: ${claimFamily}.`];
  if (claimFamily === "discrimination") {
    const band = estimateInjuryToFeelingsBand();
    assumptions.push(`${band.label} Indicative band £${band.lower}–£${band.upper} (scaffold only).`);
  }

  return {
    basicAward: 0,
    compensatoryAward: 0,
    acasUplift: 0,
    reductions: [],
    totalLow: 0,
    totalMid: 0,
    totalHigh: 0,
    assumptions,
    warnings: ["Use solicitor / forensic accountant for figures; scaffold does not value the claim."],
    scheduleOfLoss: [],
  };
}

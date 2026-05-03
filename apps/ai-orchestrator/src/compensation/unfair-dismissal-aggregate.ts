import {
  STATUTORY_WEEKLY_PAY_CAP,
  UNFAIR_DISMISSAL_COMPENSATORY_CAP,
} from "./constants";
import type { CompensationEstimateOutput, ReductionLine, UnfairDismissalInputs } from "./compensation.types";
import { calculateBasicAwardGbp } from "./basic-award.calculator";
import { calculateCompensatoryHeadGbp } from "./compensatory-award.calculator";
import { calculateAcasUpliftGbp } from "./acas-uplift.calculator";
import { polkeyReductionGbp } from "./polkey-reduction.calculator";
import { contributoryReductionGbp } from "./contributory-conduct.calculator";
import { buildScheduleOfLoss } from "./schedule-of-loss.generator";

function applyCapLine(compensatoryNet: number): ReductionLine | null {
  if (compensatoryNet <= UNFAIR_DISMISSAL_COMPENSATORY_CAP) return null;
  return {
    code: "cap",
    label: "Statutory cap on ordinary unfair dismissal compensatory award",
    amountGbp: Math.round((compensatoryNet - UNFAIR_DISMISSAL_COMPENSATORY_CAP) * 100) / 100,
  };
}

/**
 * Compose unfair dismissal compensation estimate (deterministic scaffold).
 */
export function buildUnfairDismissalCompensation(
  input: UnfairDismissalInputs,
): CompensationEstimateOutput {
  const basic = calculateBasicAwardGbp(input);
  const compGross = calculateCompensatoryHeadGbp(input);

  const polkey = polkeyReductionGbp(compGross, input.polkeyFactor);
  const afterPolkey = Math.max(0, compGross - polkey.amountGbp);

  const contrib = contributoryReductionGbp(afterPolkey, input.contributoryFactor);
  const afterContrib = Math.max(0, afterPolkey - contrib.amountGbp);

  const capLine = applyCapLine(afterContrib);
  const afterCap = capLine ? UNFAIR_DISMISSAL_COMPENSATORY_CAP : afterContrib;

  const uplift = calculateAcasUpliftGbp(afterCap, input.acasUpliftFactor);

  const reductions: ReductionLine[] = [polkey, contrib];
  if (capLine) reductions.push(capLine);
  if (input.mitigationFactor > 0) {
    reductions.push({
      code: "mitigation",
      label: "Mitigation haircut (applied inside compensatory head)",
      amountGbp: 0,
      factor: input.mitigationFactor,
    });
  }

  const totalMid = Math.round((basic + afterCap + uplift) * 100) / 100;
  const totalLow = Math.round(totalMid * 0.85 * 100) / 100;
  const totalHigh = Math.round(totalMid * 1.12 * 100) / 100;

  const assumptions = [
    `Statutory week's pay cap £${STATUTORY_WEEKLY_PAY_CAP} from 6 April 2026 (verify in force).`,
    `Maximum compensatory (ordinary unfair dismissal) £${UNFAIR_DISMISSAL_COMPENSATORY_CAP} (verify in force).`,
    "Tax, National Insurance, recoupment of benefits, and pension accrual are not modelled.",
    "BASIC + COMPENSATORY + ACAS uplift shown as separate heads before statutory blending rules.",
  ];

  const warnings = [
    "This is a litigation planning scaffold, not a substitute for actuarial / forensic accounting advice.",
    "Polkey and contributory percentages must be evidence-led — defaults here are placeholders.",
  ];

  return {
    basicAward: basic,
    compensatoryAward: afterCap,
    acasUplift: uplift,
    reductions,
    totalLow,
    totalMid,
    totalHigh,
    assumptions,
    warnings,
    scheduleOfLoss: buildScheduleOfLoss(input, basic, afterCap),
  };
}

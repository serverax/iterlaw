import { UNFAIR_DISMISSAL_COMPENSATORY_CAP, STATUTORY_WEEKLY_PAY_CAP } from "./constants";
import type { UnfairDismissalInputs } from "./compensation.types";

/**
 * Compensatory award scaffold: past + future loss of earnings + pension + benefits, before reductions.
 * Net tax effects not modelled — assumptions array should warn.
 */
export function calculateCompensatoryHeadGbp(input: UnfairDismissalInputs): number {
  const pay = Math.min(input.weeklyPayGbp, STATUTORY_WEEKLY_PAY_CAP);
  const past = pay * Math.max(0, input.pastLossWeeks);
  const future = pay * Math.max(0, input.futureLossWeeks);
  const pension = pay * input.pensionLossFactor * 8;
  const benefits = Math.max(0, input.benefitsLossGbp);
  const gross = past + future + pension + benefits;
  const mitigated = gross * (1 - Math.min(0.9, Math.max(0, input.mitigationFactor)));
  return Math.min(Math.round(mitigated * 100) / 100, UNFAIR_DISMISSAL_COMPENSATORY_CAP);
}

import { STATUTORY_WEEKLY_PAY_CAP } from "./constants";
import type { UnfairDismissalInputs } from "./compensation.types";

function weekMultiplier(ageAtYear: number): number {
  if (ageAtYear < 22) return 0.5;
  if (ageAtYear <= 40) return 1;
  return 1.5;
}

/**
 * Basic award for unfair dismissal — ERA 1996 s.119 length-of-service formula (scaffold).
 * Uses age at each completed service year counting backwards from current age.
 */
export function calculateBasicAwardGbp(input: UnfairDismissalInputs): number {
  const cappedWeekly = Math.min(input.weeklyPayGbp, STATUTORY_WEEKLY_PAY_CAP);
  const completeYears = Math.min(Math.max(Math.floor(input.yearsOfService), 0), 20);
  let total = 0;
  for (let k = 0; k < completeYears; k++) {
    const ageAtYear = Math.max(16, input.age - (completeYears - 1 - k));
    total += cappedWeekly * weekMultiplier(ageAtYear);
  }
  return Math.round(total * 100) / 100;
}

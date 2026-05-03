import { ACAS_UPLIFT_MAX_FRACTION } from "./constants";

/** ACAS uplift applies to compensatory award only (scaffold). */
export function calculateAcasUpliftGbp(compensatoryAfterReductions: number, upliftFactor: number): number {
  const f = Math.min(ACAS_UPLIFT_MAX_FRACTION, Math.max(0, upliftFactor));
  return Math.round(compensatoryAfterReductions * f * 100) / 100;
}

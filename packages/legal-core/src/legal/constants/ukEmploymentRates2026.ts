/**
 * UK employment rates — England & Wales oriented constants for ERA 2025-era tooling.
 *
 * These values are legislative/policy snapshots for product logic. In production,
 * prefer migrating authoritative figures to `legal_constants` (DB) with citations;
 * this module remains the typed fallback / seed reference for Phase 1B.
 */

/** National Living Wage (21+) — from 1 April 2026 */
export const NLW_21_PLUS_HOURLY_GBP = 12.71 as const;
export const NLW_21_PLUS_EFFECTIVE_FROM = '2026-04-01';

/** Statutory Sick Pay weekly rate cap — from 6 April 2026 */
export const SSP_WEEKLY_RATE_CAP_GBP = 123.25 as const;
export const SSP_EFFECTIVE_FROM = '2026-04-06';

/** Statutory maternity / paternity / adoption / shared parental weekly rate (where flat rate applies) */
export const STATUTORY_FAMILY_PAY_WEEKLY_GBP = 194.32 as const;

/** Lower Earnings Limit (weekly) — snapshot for calculators */
export const LOWER_EARNINGS_LIMIT_WEEKLY_GBP = 129 as const;

/** SSP: lower of statutory weekly cap or 80% of average weekly earnings */
export function sspWeeklyPayGbp(averageWeeklyEarningsGbp: number): number {
  const eightyPercent = 0.8 * averageWeeklyEarningsGbp;
  return Math.min(SSP_WEEKLY_RATE_CAP_GBP, eightyPercent);
}

/** Statutory family pay: lower of flat weekly rate or 90% AWE where the 90% rule applies */
export function statutoryFamilyPayWeeklyGbp(averageWeeklyEarningsGbp: number): number {
  const ninetyPercent = 0.9 * averageWeeklyEarningsGbp;
  return Math.min(STATUTORY_FAMILY_PAY_WEEKLY_GBP, ninetyPercent);
}

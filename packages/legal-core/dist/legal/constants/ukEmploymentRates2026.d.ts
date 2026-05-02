/**
 * UK employment rates — England & Wales oriented constants for ERA 2025-era tooling.
 *
 * These values are legislative/policy snapshots for product logic. In production,
 * prefer migrating authoritative figures to `legal_constants` (DB) with citations;
 * this module remains the typed fallback / seed reference for Phase 1B.
 */
/** National Living Wage (21+) — from 1 April 2026 */
export declare const NLW_21_PLUS_HOURLY_GBP: 12.71;
export declare const NLW_21_PLUS_EFFECTIVE_FROM = "2026-04-01";
/** Statutory Sick Pay weekly rate cap — from 6 April 2026 */
export declare const SSP_WEEKLY_RATE_CAP_GBP: 123.25;
export declare const SSP_EFFECTIVE_FROM = "2026-04-06";
/** Statutory maternity / paternity / adoption / shared parental weekly rate (where flat rate applies) */
export declare const STATUTORY_FAMILY_PAY_WEEKLY_GBP: 194.32;
/** Lower Earnings Limit (weekly) — snapshot for calculators */
export declare const LOWER_EARNINGS_LIMIT_WEEKLY_GBP: 129;
/** SSP: lower of statutory weekly cap or 80% of average weekly earnings */
export declare function sspWeeklyPayGbp(averageWeeklyEarningsGbp: number): number;
/** Statutory family pay: lower of flat weekly rate or 90% AWE where the 90% rule applies */
export declare function statutoryFamilyPayWeeklyGbp(averageWeeklyEarningsGbp: number): number;
//# sourceMappingURL=ukEmploymentRates2026.d.ts.map
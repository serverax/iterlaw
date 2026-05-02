"use strict";
/**
 * UK employment rates — England & Wales oriented constants for ERA 2025-era tooling.
 *
 * These values are legislative/policy snapshots for product logic. In production,
 * prefer migrating authoritative figures to `legal_constants` (DB) with citations;
 * this module remains the typed fallback / seed reference for Phase 1B.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOWER_EARNINGS_LIMIT_WEEKLY_GBP = exports.STATUTORY_FAMILY_PAY_WEEKLY_GBP = exports.SSP_EFFECTIVE_FROM = exports.SSP_WEEKLY_RATE_CAP_GBP = exports.NLW_21_PLUS_EFFECTIVE_FROM = exports.NLW_21_PLUS_HOURLY_GBP = void 0;
exports.sspWeeklyPayGbp = sspWeeklyPayGbp;
exports.statutoryFamilyPayWeeklyGbp = statutoryFamilyPayWeeklyGbp;
/** National Living Wage (21+) — from 1 April 2026 */
exports.NLW_21_PLUS_HOURLY_GBP = 12.71;
exports.NLW_21_PLUS_EFFECTIVE_FROM = '2026-04-01';
/** Statutory Sick Pay weekly rate cap — from 6 April 2026 */
exports.SSP_WEEKLY_RATE_CAP_GBP = 123.25;
exports.SSP_EFFECTIVE_FROM = '2026-04-06';
/** Statutory maternity / paternity / adoption / shared parental weekly rate (where flat rate applies) */
exports.STATUTORY_FAMILY_PAY_WEEKLY_GBP = 194.32;
/** Lower Earnings Limit (weekly) — snapshot for calculators */
exports.LOWER_EARNINGS_LIMIT_WEEKLY_GBP = 129;
/** SSP: lower of statutory weekly cap or 80% of average weekly earnings */
function sspWeeklyPayGbp(averageWeeklyEarningsGbp) {
    const eightyPercent = 0.8 * averageWeeklyEarningsGbp;
    return Math.min(exports.SSP_WEEKLY_RATE_CAP_GBP, eightyPercent);
}
/** Statutory family pay: lower of flat weekly rate or 90% AWE where the 90% rule applies */
function statutoryFamilyPayWeeklyGbp(averageWeeklyEarningsGbp) {
    const ninetyPercent = 0.9 * averageWeeklyEarningsGbp;
    return Math.min(exports.STATUTORY_FAMILY_PAY_WEEKLY_GBP, ninetyPercent);
}

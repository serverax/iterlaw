/**
 * Configurable statutory limits — verify against current Treasury / ET rules before production use.
 */

export const STATUTORY_WEEKLY_PAY_CAP = 751;

export const UNFAIR_DISMISSAL_COMPENSATORY_CAP = 123_543;

/** ACAS uplift cap as a percentage (e.g. 25 = 25%). */
export const ACAS_UPLIFT_MAX_PERCENT = 25;

export const ACAS_UPLIFT_MAX_FRACTION = ACAS_UPLIFT_MAX_PERCENT / 100;

/** @deprecated use STATUTORY_WEEKLY_PAY_CAP */
export const STATUTORY_WEEK_PAY_CAP_GBP = STATUTORY_WEEKLY_PAY_CAP;

/** @deprecated use UNFAIR_DISMISSAL_COMPENSATORY_CAP */
export const MAX_UNFAIR_DISMISSAL_COMPENSATORY_GBP = UNFAIR_DISMISSAL_COMPENSATORY_CAP;

/** @deprecated use ACAS_UPLIFT_MAX_FRACTION */
export const ACAS_UPLIFT_MAX_PCT = ACAS_UPLIFT_MAX_FRACTION;

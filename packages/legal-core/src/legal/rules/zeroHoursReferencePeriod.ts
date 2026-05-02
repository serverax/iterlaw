/**
 * Zero-hours / variable hours — 12-week reference period for guaranteed-hours style reviews.
 */

export const REFERENCE_WEEKS = 12 as const;

export type WeekHoursEntry = {
  weekStartIso: string;
  hours: number;
};

export type ZeroHoursReferenceState = {
  weeks: WeekHoursEntry[];
};

export function createZeroHoursReferenceState(): ZeroHoursReferenceState {
  return { weeks: [] };
}

export function addWeekHours(state: ZeroHoursReferenceState, entry: WeekHoursEntry): void {
  if (entry.hours < 0 || !Number.isFinite(entry.hours)) {
    throw new Error('hours must be a non-negative finite number');
  }
  state.weeks.push({ weekStartIso: entry.weekStartIso, hours: entry.hours });
}

export function completedReferenceWeeks(state: ZeroHoursReferenceState): number {
  return Math.min(state.weeks.length, REFERENCE_WEEKS);
}

/** Average over up to the last 12 recorded weeks */
export function twelveWeekAverageHours(state: ZeroHoursReferenceState): number | null {
  if (state.weeks.length === 0) return null;
  const slice = state.weeks.slice(-REFERENCE_WEEKS);
  const sum = slice.reduce((s, w) => s + w.hours, 0);
  return sum / slice.length;
}

export const GUARANTEED_HOURS_REVIEW_MESSAGE =
  'Potential right to guaranteed hours offer review required.';

export function requiresGuaranteedHoursOfferReview(state: ZeroHoursReferenceState): boolean {
  return state.weeks.length >= REFERENCE_WEEKS;
}

export function guaranteedHoursReviewMessageIfDue(state: ZeroHoursReferenceState): string | null {
  return requiresGuaranteedHoursOfferReview(state) ? GUARANTEED_HOURS_REVIEW_MESSAGE : null;
}

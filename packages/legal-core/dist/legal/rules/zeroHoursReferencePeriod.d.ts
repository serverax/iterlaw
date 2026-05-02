/**
 * Zero-hours / variable hours — 12-week reference period for guaranteed-hours style reviews.
 */
export declare const REFERENCE_WEEKS: 12;
export type WeekHoursEntry = {
    weekStartIso: string;
    hours: number;
};
export type ZeroHoursReferenceState = {
    weeks: WeekHoursEntry[];
};
export declare function createZeroHoursReferenceState(): ZeroHoursReferenceState;
export declare function addWeekHours(state: ZeroHoursReferenceState, entry: WeekHoursEntry): void;
export declare function completedReferenceWeeks(state: ZeroHoursReferenceState): number;
/** Average over up to the last 12 recorded weeks */
export declare function twelveWeekAverageHours(state: ZeroHoursReferenceState): number | null;
export declare const GUARANTEED_HOURS_REVIEW_MESSAGE = "Potential right to guaranteed hours offer review required.";
export declare function requiresGuaranteedHoursOfferReview(state: ZeroHoursReferenceState): boolean;
export declare function guaranteedHoursReviewMessageIfDue(state: ZeroHoursReferenceState): string | null;
//# sourceMappingURL=zeroHoursReferencePeriod.d.ts.map
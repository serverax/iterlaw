/**
 * ERA 2025 transition — unfair dismissal qualifying service (standard claims only).
 * Does not assess automatic unfair dismissal, discrimination, whistleblowing, etc.
 */
export declare const EXCEPTIONS_REVIEW_NOTE = "Automatic unfair dismissal, discrimination, whistleblowing, health and safety, trade union, and other statutory exceptions are not evaluated here; check separately.";
export type UnfairDismissalTransitionAssessment = {
    terminationDate: string;
    continuousServiceMonths: number;
    standardQualifyingMonthsRequired: number;
    meetsStandardQualifyingService: boolean;
    /** True when standard qualifying service is not met — does not mean “no claim” */
    belowStandardQualifyingService: boolean;
    warnings: string[];
    exceptionReviewNote: typeof EXCEPTIONS_REVIEW_NOTE;
};
export declare function standardUnfairDismissalQualifyingMonths(terminationDateIso: string): number;
export declare function assessUnfairDismissalTransition(input: {
    terminationDateIso: string;
    continuousServiceMonths: number;
}): UnfairDismissalTransitionAssessment;
//# sourceMappingURL=unfairDismissalTransition.d.ts.map
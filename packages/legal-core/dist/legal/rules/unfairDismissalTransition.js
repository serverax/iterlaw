"use strict";
/**
 * ERA 2025 transition — unfair dismissal qualifying service (standard claims only).
 * Does not assess automatic unfair dismissal, discrimination, whistleblowing, etc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXCEPTIONS_REVIEW_NOTE = void 0;
exports.standardUnfairDismissalQualifyingMonths = standardUnfairDismissalQualifyingMonths;
exports.assessUnfairDismissalTransition = assessUnfairDismissalTransition;
const TRANSITION_DATE = new Date('2027-01-01T00:00:00.000Z');
const QUALIFYING_PRE_2027_MONTHS = 24;
const QUALIFYING_FROM_2027_MONTHS = 6;
exports.EXCEPTIONS_REVIEW_NOTE = 'Automatic unfair dismissal, discrimination, whistleblowing, health and safety, trade union, and other statutory exceptions are not evaluated here; check separately.';
const TRANSITION_WARNING = 'Standard unfair dismissal protection may not yet apply. Protection is expected to reduce to 6 months from 1 January 2027. Check automatic unfair dismissal exceptions separately.';
function parseTermination(isoDate) {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) {
        throw new Error(`Invalid termination date: ${isoDate}`);
    }
    return d;
}
function standardUnfairDismissalQualifyingMonths(terminationDateIso) {
    const t = parseTermination(terminationDateIso);
    return t < TRANSITION_DATE ? QUALIFYING_PRE_2027_MONTHS : QUALIFYING_FROM_2027_MONTHS;
}
function assessUnfairDismissalTransition(input) {
    const t = parseTermination(input.terminationDateIso);
    const required = standardUnfairDismissalQualifyingMonths(input.terminationDateIso);
    const meets = input.continuousServiceMonths >= required;
    const warnings = [];
    if (t < TRANSITION_DATE &&
        input.continuousServiceMonths >= 6 &&
        input.continuousServiceMonths <= 23) {
        warnings.push(TRANSITION_WARNING);
    }
    return {
        terminationDate: input.terminationDateIso,
        continuousServiceMonths: input.continuousServiceMonths,
        standardQualifyingMonthsRequired: required,
        meetsStandardQualifyingService: meets,
        belowStandardQualifyingService: !meets,
        warnings,
        exceptionReviewNote: exports.EXCEPTIONS_REVIEW_NOTE,
    };
}

/**
 * ERA 2025 transition — unfair dismissal qualifying service (standard claims only).
 * Does not assess automatic unfair dismissal, discrimination, whistleblowing, etc.
 */

const TRANSITION_DATE = new Date('2027-01-01T00:00:00.000Z');
const QUALIFYING_PRE_2027_MONTHS = 24;
const QUALIFYING_FROM_2027_MONTHS = 6;

export const EXCEPTIONS_REVIEW_NOTE =
  'Automatic unfair dismissal, discrimination, whistleblowing, health and safety, trade union, and other statutory exceptions are not evaluated here; check separately.';

const TRANSITION_WARNING =
  'Standard unfair dismissal protection may not yet apply. Protection is expected to reduce to 6 months from 1 January 2027. Check automatic unfair dismissal exceptions separately.';

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

function parseTermination(isoDate: string): Date {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid termination date: ${isoDate}`);
  }
  return d;
}

export function standardUnfairDismissalQualifyingMonths(terminationDateIso: string): number {
  const t = parseTermination(terminationDateIso);
  return t < TRANSITION_DATE ? QUALIFYING_PRE_2027_MONTHS : QUALIFYING_FROM_2027_MONTHS;
}

export function assessUnfairDismissalTransition(input: {
  terminationDateIso: string;
  continuousServiceMonths: number;
}): UnfairDismissalTransitionAssessment {
  const t = parseTermination(input.terminationDateIso);
  const required = standardUnfairDismissalQualifyingMonths(input.terminationDateIso);
  const meets = input.continuousServiceMonths >= required;
  const warnings: string[] = [];

  if (
    t < TRANSITION_DATE &&
    input.continuousServiceMonths >= 6 &&
    input.continuousServiceMonths <= 23
  ) {
    warnings.push(TRANSITION_WARNING);
  }

  return {
    terminationDate: input.terminationDateIso,
    continuousServiceMonths: input.continuousServiceMonths,
    standardQualifyingMonthsRequired: required,
    meetsStandardQualifyingService: meets,
    belowStandardQualifyingService: !meets,
    warnings,
    exceptionReviewNote: EXCEPTIONS_REVIEW_NOTE,
  };
}

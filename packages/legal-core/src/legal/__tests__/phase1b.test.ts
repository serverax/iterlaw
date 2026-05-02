import { assessFireAndRehire, isFinancialNecessityAcceptedWithoutEvidence } from '../rules/fireAndRehire';
import { assessUnfairDismissalTransition, EXCEPTIONS_REVIEW_NOTE } from '../rules/unfairDismissalTransition';
import {
  addWeekHours,
  createZeroHoursReferenceState,
  guaranteedHoursReviewMessageIfDue,
  twelveWeekAverageHours,
} from '../rules/zeroHoursReferencePeriod';
import { requiresPayrollRecordAudit } from '../rules/payAuditTriggers';
import { sspWeeklyPayGbp } from '../constants/ukEmploymentRates2026';

describe('PHASE 1B — unfair dismissal transition (Jan 2027)', () => {
  it('18 months service dismissed Dec 2026 — below 24-month standard threshold', () => {
    const r = assessUnfairDismissalTransition({
      terminationDateIso: '2026-12-15',
      continuousServiceMonths: 18,
    });
    expect(r.standardQualifyingMonthsRequired).toBe(24);
    expect(r.meetsStandardQualifyingService).toBe(false);
    expect(r.belowStandardQualifyingService).toBe(true);
    expect(r.exceptionReviewNote).toBe(EXCEPTIONS_REVIEW_NOTE);
  });

  it('18 months service dismissed Jan 2027 — standard UD qualifying period 6 months', () => {
    const r = assessUnfairDismissalTransition({
      terminationDateIso: '2027-01-15',
      continuousServiceMonths: 18,
    });
    expect(r.standardQualifyingMonthsRequired).toBe(6);
    expect(r.meetsStandardQualifyingService).toBe(true);
    expect(r.exceptionReviewNote).toBe(EXCEPTIONS_REVIEW_NOTE);
  });

  it('5 months service Jan 2027 — below 6-month threshold', () => {
    const r = assessUnfairDismissalTransition({
      terminationDateIso: '2027-01-10',
      continuousServiceMonths: 5,
    });
    expect(r.standardQualifyingMonthsRequired).toBe(6);
    expect(r.meetsStandardQualifyingService).toBe(false);
    expect(r.exceptionReviewNote).toBe(EXCEPTIONS_REVIEW_NOTE);
  });

  it('6–23 months service before 2027-01-01 — emits transition warning (not “no claim”)', () => {
    const r = assessUnfairDismissalTransition({
      terminationDateIso: '2026-11-01',
      continuousServiceMonths: 12,
    });
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.warnings[0]).toContain('1 January 2027');
    expect(r.exceptionReviewNote).toContain('Automatic unfair dismissal');
  });
});

describe('PHASE 1B — SSP', () => {
  it('SSP is lower of £123.25 or 80% AWE', () => {
    expect(sspWeeklyPayGbp(200)).toBeCloseTo(123.25, 2);
    expect(sspWeeklyPayGbp(100)).toBeCloseTo(80, 5);
  });
});

describe('PHASE 1B — zero-hours 12-week average', () => {
  it('after 12 weeks, review message is returned and average is correct', () => {
    const s = createZeroHoursReferenceState();
    for (let i = 0; i < 12; i++) {
      addWeekHours(s, { weekStartIso: `2026-01-${String(i + 1).padStart(2, '0')}`, hours: 10 });
    }
    expect(twelveWeekAverageHours(s)).toBeCloseTo(10, 5);
    expect(guaranteedHoursReviewMessageIfDue(s)).toContain('guaranteed hours');
  });
});

describe('PHASE 1B — fire and rehire financial necessity', () => {
  it('financial necessity claimed without evidence is not accepted', () => {
    const input = {
      dismissalAndReengagementPattern: true,
      imposedRestrictedVariation: false,
      financial_necessity_claimed: true as const,
      evidencePresent: {},
    };
    expect(isFinancialNecessityAcceptedWithoutEvidence(input)).toBe(true);
    const a = assessFireAndRehire(input);
    expect(a.financial_necessity_unsupported).toBe(true);
    expect(a.flags).toContain('financial_necessity_claimed_without_evidence');
  });
});

describe('PHASE 1B — pay audit triggers', () => {
  it('pay-related issues require payroll record audit flag', () => {
    expect(requiresPayrollRecordAudit(['pay', 'holiday_pay'])).toBe(true);
    expect(requiresPayrollRecordAudit([])).toBe(false);
  });
});

/**
 * Fair Work / payroll record audit triggers — documentation of when record review is required.
 * (Logic flags only; does not contact regulators.)
 */

export type PayRelatedIssue =
  | 'pay'
  | 'holiday_pay'
  | 'ssp'
  | 'wage_deductions'
  | 'zero_hours'
  | 'working_time';

const TRIGGER_ISSUES: ReadonlySet<PayRelatedIssue> = new Set([
  'pay',
  'holiday_pay',
  'ssp',
  'wage_deductions',
  'zero_hours',
  'working_time',
]);

export function requiresPayrollRecordAudit(issues: PayRelatedIssue[]): boolean {
  return issues.some((i) => TRIGGER_ISSUES.has(i));
}

export const HOLIDAY_PAY_RETENTION_WARNING =
  'Holiday and pay records may be subject to statutory retention requirements; obtain and preserve payroll, leave, and payslip evidence where a dispute is possible.';

export function payAuditMessages(issues: PayRelatedIssue[]): string[] {
  const msgs: string[] = [];
  if (requiresPayrollRecordAudit(issues)) {
    msgs.push('Payroll and holiday record audit required for the issues identified.');
  }
  if (issues.includes('holiday_pay') || issues.includes('pay')) {
    msgs.push(HOLIDAY_PAY_RETENTION_WARNING);
  }
  return msgs;
}

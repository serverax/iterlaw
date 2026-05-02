/**
 * Fair Work / payroll record audit triggers — documentation of when record review is required.
 * (Logic flags only; does not contact regulators.)
 */
export type PayRelatedIssue = 'pay' | 'holiday_pay' | 'ssp' | 'wage_deductions' | 'zero_hours' | 'working_time';
export declare function requiresPayrollRecordAudit(issues: PayRelatedIssue[]): boolean;
export declare const HOLIDAY_PAY_RETENTION_WARNING = "Holiday and pay records may be subject to statutory retention requirements; obtain and preserve payroll, leave, and payslip evidence where a dispute is possible.";
export declare function payAuditMessages(issues: PayRelatedIssue[]): string[];
//# sourceMappingURL=payAuditTriggers.d.ts.map
"use strict";
/**
 * Fair Work / payroll record audit triggers — documentation of when record review is required.
 * (Logic flags only; does not contact regulators.)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HOLIDAY_PAY_RETENTION_WARNING = void 0;
exports.requiresPayrollRecordAudit = requiresPayrollRecordAudit;
exports.payAuditMessages = payAuditMessages;
const TRIGGER_ISSUES = new Set([
    'pay',
    'holiday_pay',
    'ssp',
    'wage_deductions',
    'zero_hours',
    'working_time',
]);
function requiresPayrollRecordAudit(issues) {
    return issues.some((i) => TRIGGER_ISSUES.has(i));
}
exports.HOLIDAY_PAY_RETENTION_WARNING = 'Holiday and pay records may be subject to statutory retention requirements; obtain and preserve payroll, leave, and payslip evidence where a dispute is possible.';
function payAuditMessages(issues) {
    const msgs = [];
    if (requiresPayrollRecordAudit(issues)) {
        msgs.push('Payroll and holiday record audit required for the issues identified.');
    }
    if (issues.includes('holiday_pay') || issues.includes('pay')) {
        msgs.push(exports.HOLIDAY_PAY_RETENTION_WARNING);
    }
    return msgs;
}

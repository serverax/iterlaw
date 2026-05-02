"use strict";
/**
 * Zero-hours / variable hours — 12-week reference period for guaranteed-hours style reviews.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GUARANTEED_HOURS_REVIEW_MESSAGE = exports.REFERENCE_WEEKS = void 0;
exports.createZeroHoursReferenceState = createZeroHoursReferenceState;
exports.addWeekHours = addWeekHours;
exports.completedReferenceWeeks = completedReferenceWeeks;
exports.twelveWeekAverageHours = twelveWeekAverageHours;
exports.requiresGuaranteedHoursOfferReview = requiresGuaranteedHoursOfferReview;
exports.guaranteedHoursReviewMessageIfDue = guaranteedHoursReviewMessageIfDue;
exports.REFERENCE_WEEKS = 12;
function createZeroHoursReferenceState() {
    return { weeks: [] };
}
function addWeekHours(state, entry) {
    if (entry.hours < 0 || !Number.isFinite(entry.hours)) {
        throw new Error('hours must be a non-negative finite number');
    }
    state.weeks.push({ weekStartIso: entry.weekStartIso, hours: entry.hours });
}
function completedReferenceWeeks(state) {
    return Math.min(state.weeks.length, exports.REFERENCE_WEEKS);
}
/** Average over up to the last 12 recorded weeks */
function twelveWeekAverageHours(state) {
    if (state.weeks.length === 0)
        return null;
    const slice = state.weeks.slice(-exports.REFERENCE_WEEKS);
    const sum = slice.reduce((s, w) => s + w.hours, 0);
    return sum / slice.length;
}
exports.GUARANTEED_HOURS_REVIEW_MESSAGE = 'Potential right to guaranteed hours offer review required.';
function requiresGuaranteedHoursOfferReview(state) {
    return state.weeks.length >= exports.REFERENCE_WEEKS;
}
function guaranteedHoursReviewMessageIfDue(state) {
    return requiresGuaranteedHoursOfferReview(state) ? exports.GUARANTEED_HOURS_REVIEW_MESSAGE : null;
}

"use strict";
/**
 * LVC — Legal Verification Controller (strict validation between ART and SEA).
 * Deterministic checks only; does not replace human legal review.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyLegalOutput = verifyLegalOutput;
exports.lvcConfidenceBand = lvcConfidenceBand;
const unfairDismissalTransition_1 = require("../../legal/rules/unfairDismissalTransition");
const COVERAGE_TOPICS = [
    { id: 'unfair_dismissal', label: 'ordinary unfair dismissal / qualifying service', patterns: [/unfair\s+dismissal/i, /qualifying\s+service/i, /ordinary\s+unfair/i] },
    { id: 'automatic_unfair', label: 'automatic unfair dismissal heads', patterns: [/automatic\s+unfair/i, /automatically\s+unfair/i, /s\.152/i, /s\.100/i] },
    { id: 'discrimination', label: 'discrimination (Equality Act)', patterns: [/discrimination/i, /equality\s+act/i, /protected\s+characteristic/i] },
    { id: 'acas_procedural', label: 'procedural fairness / ACAS Code', patterns: [/acas/i, /code\s+of\s+practice/i, /procedural\s+fairness/i, /grievance|disciplinary\s+procedure/i] },
];
function normalizeSourceType(raw) {
    if (typeof raw !== 'string')
        return '';
    return raw.trim().toLowerCase();
}
function isValidSourceType(sourceType) {
    const s = sourceType.toLowerCase();
    if (!s)
        return false;
    if (s.includes('gov.uk') || s === 'gov.uk' || s.includes('government'))
        return true;
    if (s.includes('acas'))
        return true;
    if (s.includes('legislation'))
        return true;
    return false;
}
function hasNonEmptyReference(ref) {
    return typeof ref === 'string' && ref.trim().length > 0;
}
function collectReasoningText(reasoning_output) {
    if (typeof reasoning_output === 'string')
        return reasoning_output;
    const o = reasoning_output;
    const parts = [o.trace, o.summary, o.reasoning, o.narrative, o.analysis]
        .filter((x) => typeof x === 'string')
        .map((x) => x);
    if (Array.isArray(o.steps)) {
        for (const step of o.steps) {
            if (step && typeof step === 'object' && typeof step.text === 'string') {
                parts.push(String(step.text));
            }
        }
    }
    return parts.join('\n');
}
function getTopicsAddressed(reasoning_output) {
    const found = new Set();
    const text = collectReasoningText(reasoning_output);
    if (typeof reasoning_output === 'object' && reasoning_output !== null && !Array.isArray(reasoning_output)) {
        const raw = reasoning_output.topicsAddressed;
        if (Array.isArray(raw)) {
            for (const t of raw) {
                if (typeof t === 'string')
                    found.add(t.toLowerCase());
            }
        }
    }
    for (const topic of COVERAGE_TOPICS) {
        if (topic.patterns.some((re) => re.test(text))) {
            found.add(topic.id);
        }
    }
    return found;
}
function getTerminationIso(facts) {
    const v = facts.termination_date_iso ??
        facts.dismissal_date_iso ??
        facts.terminationDate ??
        facts.dismissalDate;
    return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}
function getServiceMonths(facts) {
    const v = facts.continuous_service_months ?? facts.service_months ?? facts.continuousServiceMonths;
    if (typeof v === 'number' && Number.isFinite(v))
        return Math.floor(v);
    if (typeof v === 'string' && /^\d+$/.test(v))
        return parseInt(v, 10);
    return null;
}
function reasoningAssumesFactsNotInExtracted(reasoningText, facts) {
    const missing = [];
    const factKeys = new Set(Object.keys(facts).map((k) => k.toLowerCase()));
    const marker = /\[REQUIRES_FACT:\s*([^\]]+)\]/gi;
    let m;
    while ((m = marker.exec(reasoningText)) !== null) {
        const captured = m[1];
        if (!captured)
            continue;
        const key = captured.trim().toLowerCase();
        if (key && !factKeys.has(key)) {
            missing.push(`Fact "${captured.trim()}" referenced in reasoning but not present in extracted_facts`);
        }
    }
    const needsTermination = /qualifying\s+period|unfair\s+dismissal|limitation|january\s+2027|2027-01-01/i.test(reasoningText);
    const hasTermination = Boolean(getTerminationIso(facts));
    if (needsTermination && !hasTermination) {
        missing.push('termination_date_iso (or equivalent) for qualifying / limitation / Jan 2027 transition checks');
    }
    return missing;
}
function scoreConfidence(params) {
    let s = 100;
    s -= params.errorCount * 22;
    s -= params.warningCount * 6;
    s -= params.missingCount * 12;
    s -= params.sourceFailures * 28;
    return Math.max(0, Math.min(100, Math.round(s)));
}
/**
 * Validates ART output before SEA. Does not mutate input.
 */
function verifyLegalOutput(input) {
    const errors = [];
    const warnings = [];
    const missing_evidence = [];
    const reasoningText = collectReasoningText(input.reasoning_output);
    missing_evidence.push(...reasoningAssumesFactsNotInExtracted(reasoningText, input.extracted_facts));
    // --- 1. Source validation (legal conclusions) ---
    let sourceFailures = 0;
    if (!Array.isArray(input.legal_conclusions) || input.legal_conclusions.length === 0) {
        errors.push('legal_conclusions must be a non-empty array');
        sourceFailures += 1;
    }
    else {
        for (let i = 0; i < input.legal_conclusions.length; i++) {
            const c = input.legal_conclusions[i];
            if (c === undefined)
                continue;
            const st = normalizeSourceType(c.source_type);
            const ref = c.reference;
            if (!isValidSourceType(st)) {
                errors.push(`Conclusion ${i + 1}: source_type must indicate GOV.UK, ACAS, or legislation (got: ${String(c.source_type)})`);
                sourceFailures += 1;
            }
            if (!hasNonEmptyReference(ref)) {
                errors.push(`Conclusion ${i + 1}: reference (citation / URL / statutory anchor) is required`);
                sourceFailures += 1;
            }
        }
    }
    // --- 2. Date / transition validation ---
    const term = getTerminationIso(input.extracted_facts);
    const svc = getServiceMonths(input.extracted_facts);
    if (term && svc !== null) {
        try {
            const ud = (0, unfairDismissalTransition_1.assessUnfairDismissalTransition)({
                terminationDateIso: term,
                continuousServiceMonths: svc,
            });
            const claimsOrdinaryUd = /ordinary\s+unfair|two\s*[- ]?\s*year|two\s+year|24\s*month|six\s*[- ]?\s*month|6\s*month/i.test(reasoningText + ' ' + JSON.stringify(input.legal_conclusions));
            if (claimsOrdinaryUd && !ud.meetsStandardQualifyingService) {
                errors.push(`Date/service inconsistent with standard unfair dismissal qualifying period (termination ${term}, ${svc} months service; required ${ud.standardQualifyingMonthsRequired} months).`);
            }
            for (const w of ud.warnings) {
                warnings.push(w);
            }
        }
        catch {
            errors.push('Invalid termination_date_iso in extracted_facts for transition logic');
        }
    }
    else if (/(unfair\s+dismissal|qualifying\s+period)/i.test(reasoningText) && (!term || svc === null)) {
        warnings.push('Unfair dismissal / qualifying period discussed but termination date or continuous service months missing from extracted_facts — human review required.');
    }
    // --- 4. Legal coverage (ART) — only when reasoning is clearly employment / dismissal related ---
    const employmentContext = /employ|dismiss|disciplin|tribunal|redundan|grievance|unfair|discriminat/i.test(reasoningText);
    if (employmentContext) {
        const addressed = getTopicsAddressed(input.reasoning_output);
        for (const topic of COVERAGE_TOPICS) {
            if (!addressed.has(topic.id)) {
                warnings.push(`ART coverage: no clear treatment of "${topic.label}" (${topic.id}).`);
            }
        }
    }
    const verified = errors.length === 0;
    const confidence_score = scoreConfidence({
        errorCount: errors.length,
        warningCount: warnings.length,
        missingCount: missing_evidence.length,
        sourceFailures,
    });
    const requires_review = !verified || confidence_score < 70 || missing_evidence.length > 0;
    return {
        verified,
        errors,
        warnings,
        missing_evidence,
        requires_review,
        confidence_score,
    };
}
function lvcConfidenceBand(score) {
    if (score < 40)
        return 'unsafe';
    if (score < 70)
        return 'needs_review';
    return 'strong';
}

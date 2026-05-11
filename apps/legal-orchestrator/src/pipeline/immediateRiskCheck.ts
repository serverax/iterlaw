// Deterministic immediate risk check (Phase 7 of the bundle, narrowed).
// Does NOT give legal advice. Reports rule hits + missing facts only.

import type { Classification, ExtractedFacts, RiskCheck } from "../types/legal.js";

// 3 months minus 1 day in milliseconds — UK employment tribunal limitation
// is "3 months less one day" from the act complained of.
const THREE_MONTHS_MINUS_ONE_DAY_MS = 1000 * 60 * 60 * 24 * 91 - 1;

function parseDateSafe(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function immediateRiskCheck(input: {
  classification: Classification;
  facts: ExtractedFacts;
  now?: Date;
}): RiskCheck {
  const { classification, facts } = input;
  const now = input.now ?? new Date();

  const missingFacts: string[] = [];
  const ruleHits: string[] = [];
  const warnings: string[] = [];

  // Rule 1: tribunal-style limitation check
  if (classification.requires_deadline_check) {
    if (!facts.dismissal_date && classification.area_of_law === "unfair_dismissal") {
      missingFacts.push("dismissal_date");
    }
    if (!facts.dismissal_date && classification.area_of_law === "constructive_dismissal") {
      missingFacts.push("dismissal_date");
    }
    if (!facts.incident_date && classification.area_of_law === "discrimination") {
      missingFacts.push("incident_date");
    }
    if (!facts.incident_date && classification.area_of_law === "whistleblowing") {
      missingFacts.push("incident_date");
    }
  }

  // Rule 2: imminent limitation
  const triggerDate =
    parseDateSafe(facts.dismissal_date) ?? parseDateSafe(facts.incident_date);
  if (triggerDate) {
    const elapsedDays = daysBetween(triggerDate, now);
    if (elapsedDays >= 75 && elapsedDays <= 91) {
      ruleHits.push("limitation_imminent");
      warnings.push(
        "Tribunal limitation is approaching (UK 3 months less one day from the act complained of). Confirm ACAS Early Conciliation status."
      );
    } else if (elapsedDays > 91) {
      ruleHits.push("limitation_likely_expired");
      warnings.push(
        "Tribunal limitation likely expired. The claimant must seek immediate legal advice; out-of-time exceptions are narrow."
      );
    }
  }

  // Rule 3: qualifying service for ordinary unfair dismissal
  if (classification.area_of_law === "unfair_dismissal") {
    const start = parseDateSafe(facts.employment_start_date);
    const end = parseDateSafe(facts.employment_end_date) ?? parseDateSafe(facts.dismissal_date);
    if (start && end) {
      const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      if (months < 24) {
        ruleHits.push("qualifying_service_under_2_years");
        warnings.push(
          "Ordinary unfair-dismissal claims usually require 2 years' continuous service. Check automatic-unfair exceptions (e.g., pregnancy, whistleblowing, asserting a statutory right)."
        );
      }
    }
  }

  // Rule 4: discrimination + whistleblowing have no 2-year service requirement
  if (
    classification.area_of_law === "discrimination" ||
    classification.area_of_law === "whistleblowing"
  ) {
    ruleHits.push("no_qualifying_service_required");
  }

  // Rule 5: ACAS early conciliation
  if (classification.requires_deadline_check && facts.acas_started !== true) {
    ruleHits.push("acas_ec_required");
    warnings.push("Most employment tribunal claims require ACAS Early Conciliation before the claim is lodged.");
  }

  // Rule 6: suspension
  if (classification.area_of_law === "suspension") {
    if (!facts.suspension_date) missingFacts.push("suspension_date");
    ruleHits.push("suspension_basis_check");
  }

  let status: RiskCheck["status"] = "ok";
  let riskLevel: RiskCheck["risk_level"] = "low";

  if (missingFacts.length > 0) {
    status = "needs_more_facts";
    riskLevel = "unknown";
  }
  if (ruleHits.includes("limitation_imminent")) {
    status = "high_risk_deadline";
    riskLevel = "high";
  }
  if (ruleHits.includes("limitation_likely_expired")) {
    status = "high_risk_deadline";
    riskLevel = "critical";
  }

  return {
    status,
    risk_level: riskLevel,
    missing_facts: missingFacts,
    rule_hits: ruleHits,
    warnings,
  };
}

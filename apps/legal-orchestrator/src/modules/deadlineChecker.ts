// deadlineChecker — jurisdiction + area-of-law aware limitation checks.
// Builds on the generic ruleEngine and adds time-window logic specific
// to limitation periods (e.g. UK 3-months-less-one-day).

import type {
  LegalPackContext,
  DeadlineCheckerInput,
  DeadlineCheckerOutput,
} from "./contracts";
import { ruleEngine } from "./ruleEngine";

function parseIsoDate(s: unknown): Date | undefined {
  if (typeof s !== "string" || s.length === 0) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function deadlineChecker(
  input: DeadlineCheckerInput,
  ctx: LegalPackContext
): DeadlineCheckerOutput {
  const rs = ctx.ruleset;
  const now = parseIsoDate(input.now_iso) ?? new Date();

  const re = ruleEngine(
    { area_of_law: input.area_of_law, facts: input.facts, now_iso: input.now_iso },
    ctx
  );

  const out: DeadlineCheckerOutput = {
    status: re.status,
    risk_level: re.risk_level,
    missing_facts: [...re.missing_facts],
    rule_hits: [...re.rule_hits],
    warnings: [...re.warnings],
  };

  // Limitation window: derived from the most informative date the caller
  // has supplied (dismissal_date first, then incident_date).
  const triggerDate =
    parseIsoDate(input.facts.dismissal_date) ?? parseIsoDate(input.facts.incident_date);

  if (triggerDate) {
    const elapsed = daysBetween(triggerDate, now);
    const window = rs.limitation_window_days;
    if (elapsed >= window - 15 && elapsed <= window) {
      if (!out.rule_hits.includes("limitation_imminent")) out.rule_hits.push("limitation_imminent");
      out.status = "high_risk_deadline";
      out.risk_level = "high";
      out.warnings.push(
        `Statutory limitation is approaching (${input.jurisdiction.toUpperCase()} window: ${window} days from the act). Confirm ACAS EC status.`
      );
    } else if (elapsed > window) {
      if (!out.rule_hits.includes("limitation_likely_expired")) {
        out.rule_hits.push("limitation_likely_expired");
      }
      out.status = "high_risk_deadline";
      out.risk_level = "critical";
      out.warnings.push(
        `Statutory limitation likely expired (${input.jurisdiction.toUpperCase()} window: ${window} days from the act). Out-of-time exceptions are narrow.`
      );
    }
  }

  // Qualifying-service flag for ordinary unfair dismissal (UK-style).
  if (input.area_of_law === "unfair_dismissal") {
    const start = parseIsoDate(input.facts.employment_start_date);
    const end =
      parseIsoDate(input.facts.employment_end_date) ?? parseIsoDate(input.facts.dismissal_date);
    if (start && end) {
      const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      if (months < rs.qualifying_service_months_unfair_dismissal) {
        if (!out.rule_hits.includes("qualifying_service_under_threshold")) {
          out.rule_hits.push("qualifying_service_under_threshold");
        }
        out.warnings.push(
          `Ordinary unfair-dismissal claims typically require ${rs.qualifying_service_months_unfair_dismissal} months' continuous service. Check automatic-unfair exceptions.`
        );
      }
    }
  }

  if (rs.no_qualifying_service_areas.includes(input.area_of_law)) {
    if (!out.rule_hits.includes("no_qualifying_service_required")) {
      out.rule_hits.push("no_qualifying_service_required");
    }
  }

  return out;
}

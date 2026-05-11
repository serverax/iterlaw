// Generic predicate→action rule engine. Pure function. No I/O.
//
// Designed to be portable to Rust. Predicates and actions are
// data-driven so the engine itself stays small.

import type {
  LegalPackContext,
  RuleDefinition,
  RuleEngineInput,
  RuleEngineOutput,
  RulePredicate,
  RuleAction,
} from "./contracts";

function parseIsoDate(s: unknown): Date | undefined {
  if (typeof s !== "string" || s.length === 0) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

function evaluatePredicate(
  pred: RulePredicate,
  facts: Record<string, unknown>,
  now: Date
): boolean {
  switch (pred.kind) {
    case "fact_missing": {
      const v = facts[pred.fact];
      return v === undefined || v === null || v === "";
    }
    case "fact_equals":
      return facts[pred.fact] === pred.value;
    case "fact_before_date": {
      const d = parseIsoDate(facts[pred.fact]);
      const cmp = parseIsoDate(pred.date_iso);
      return d !== undefined && cmp !== undefined && d.getTime() < cmp.getTime();
    }
    case "fact_after_date": {
      const d = parseIsoDate(facts[pred.fact]);
      const cmp = parseIsoDate(pred.date_iso);
      return d !== undefined && cmp !== undefined && d.getTime() > cmp.getTime();
    }
    case "service_months_lt": {
      const start = parseIsoDate(facts[pred.start_fact]);
      const end = parseIsoDate(facts[pred.end_fact]);
      if (!start || !end) return false;
      const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      return months < pred.months;
    }
    case "elapsed_days_between": {
      const d = parseIsoDate(facts[pred.fact]);
      if (!d) return false;
      const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      return days >= pred.min_days && days <= pred.max_days;
    }
  }
}

function applyAction(action: RuleAction, out: RuleEngineOutput): void {
  switch (action.kind) {
    case "mark_missing_fact":
      if (!out.missing_facts.includes(action.value)) out.missing_facts.push(action.value);
      break;
    case "rule_hit":
      if (!out.rule_hits.includes(action.value)) out.rule_hits.push(action.value);
      break;
    case "warning":
      if (!out.warnings.includes(action.value)) out.warnings.push(action.value);
      break;
    case "set_status":
      if (
        action.value === "ok" ||
        action.value === "needs_more_facts" ||
        action.value === "high_risk_deadline"
      ) {
        out.status = action.value;
      }
      break;
    case "set_risk_level":
      if (
        action.value === "low" ||
        action.value === "medium" ||
        action.value === "high" ||
        action.value === "critical" ||
        action.value === "unknown"
      ) {
        out.risk_level = action.value;
      }
      break;
  }
}

export function ruleEngine(
  input: RuleEngineInput,
  ctx: LegalPackContext
): RuleEngineOutput {
  const out: RuleEngineOutput = {
    rule_hits: [],
    missing_facts: [],
    warnings: [],
    status: "ok",
    risk_level: "low",
  };

  const now = parseIsoDate(input.now_iso) ?? new Date();
  const ruleIds = ctx.ruleset.area_of_law_to_rule_ids[input.area_of_law] ?? [];
  const seen: Record<string, RuleDefinition> = ctx.ruleset.rules;

  for (const id of ruleIds) {
    const rule = seen[id];
    if (!rule) continue;
    if (evaluatePredicate(rule.predicate, input.facts, now)) {
      for (const a of rule.on_match) applyAction(a, out);
    }
  }

  if (out.missing_facts.length > 0) {
    out.status = "needs_more_facts";
    out.risk_level = "unknown";
  }

  return out;
}

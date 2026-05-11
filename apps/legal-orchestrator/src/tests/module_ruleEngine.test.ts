import { describe, it, expect } from "vitest";
import { ruleEngine } from "../modules/ruleEngine";
import { UK_EMPLOYMENT_CONTEXT } from "../modules/index";

describe("ruleEngine (UK)", () => {
  it("returns needs_more_facts when a fact_missing predicate fires", () => {
    const r = ruleEngine(
      { area_of_law: "unfair_dismissal", facts: {} },
      UK_EMPLOYMENT_CONTEXT
    );
    expect(r.status).toBe("needs_more_facts");
    expect(r.missing_facts).toContain("dismissal_date");
  });

  it("fires acas_ec_required when acas_started=false", () => {
    const r = ruleEngine(
      {
        area_of_law: "unfair_dismissal",
        facts: { dismissal_date: "2026-04-01", acas_started: false },
        now_iso: "2026-04-15",
      },
      UK_EMPLOYMENT_CONTEXT
    );
    expect(r.rule_hits).toContain("acas_ec_required");
  });

  it("does not fire acas_ec_required when acas_started=true", () => {
    const r = ruleEngine(
      {
        area_of_law: "unfair_dismissal",
        facts: { dismissal_date: "2026-04-01", acas_started: true },
        now_iso: "2026-04-15",
      },
      UK_EMPLOYMENT_CONTEXT
    );
    expect(r.rule_hits).not.toContain("acas_ec_required");
  });

  it("returns empty result for unknown area_of_law", () => {
    const r = ruleEngine(
      { area_of_law: "tax_appeal", facts: {} },
      UK_EMPLOYMENT_CONTEXT
    );
    expect(r.status).toBe("ok");
    expect(r.rule_hits).toEqual([]);
  });
});

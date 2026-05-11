import { describe, it, expect } from "vitest";
import { deadlineChecker } from "../modules/deadlineChecker";
import { UK_EMPLOYMENT_CONTEXT, SE_EMPLOYMENT_CONTEXT } from "../modules/index";

describe("deadlineChecker (UK)", () => {
  it("flags missing dismissal_date as needs_more_facts for unfair_dismissal", () => {
    const r = deadlineChecker(
      { jurisdiction: "uk_ew", area_of_law: "unfair_dismissal", facts: {} },
      UK_EMPLOYMENT_CONTEXT
    );
    expect(r.status).toBe("needs_more_facts");
    expect(r.missing_facts).toContain("dismissal_date");
  });

  it("flags limitation_imminent at ~80 days post-dismissal", () => {
    const eighty = new Date();
    eighty.setDate(eighty.getDate() - 80);
    const r = deadlineChecker(
      {
        jurisdiction: "uk_ew",
        area_of_law: "unfair_dismissal",
        facts: { dismissal_date: eighty.toISOString().slice(0, 10), acas_started: false },
      },
      UK_EMPLOYMENT_CONTEXT
    );
    expect(r.rule_hits).toContain("limitation_imminent");
    expect(r.status).toBe("high_risk_deadline");
    expect(r.risk_level).toBe("high");
  });

  it("flags limitation_likely_expired beyond 91 days", () => {
    const old = new Date();
    old.setDate(old.getDate() - 200);
    const r = deadlineChecker(
      {
        jurisdiction: "uk_ew",
        area_of_law: "unfair_dismissal",
        facts: { dismissal_date: old.toISOString().slice(0, 10), acas_started: false },
      },
      UK_EMPLOYMENT_CONTEXT
    );
    expect(r.rule_hits).toContain("limitation_likely_expired");
    expect(r.risk_level).toBe("critical");
  });

  it("flags qualifying-service issue for unfair dismissal under threshold", () => {
    const r = deadlineChecker(
      {
        jurisdiction: "uk_ew",
        area_of_law: "unfair_dismissal",
        facts: {
          employment_start_date: "2024-01-01",
          dismissal_date: "2025-07-01",
          acas_started: false,
        },
      },
      UK_EMPLOYMENT_CONTEXT
    );
    expect(r.rule_hits).toContain("qualifying_service_under_threshold");
  });

  it("notes discrimination needs no qualifying service", () => {
    const r = deadlineChecker(
      {
        jurisdiction: "uk_ew",
        area_of_law: "discrimination",
        facts: { incident_date: "2026-04-01", acas_started: true },
        now_iso: "2026-04-15",
      },
      UK_EMPLOYMENT_CONTEXT
    );
    expect(r.rule_hits).toContain("no_qualifying_service_required");
  });

  it("flags ACAS EC required when acas_started=false", () => {
    const r = deadlineChecker(
      {
        jurisdiction: "uk_ew",
        area_of_law: "unfair_dismissal",
        facts: { dismissal_date: "2026-04-01", acas_started: false },
        now_iso: "2026-04-15",
      },
      UK_EMPLOYMENT_CONTEXT
    );
    expect(r.rule_hits).toContain("acas_ec_required");
  });
});

describe("deadlineChecker (SE placeholder)", () => {
  it("uses SE limitation window of 60 days", () => {
    const sixtyFive = new Date();
    sixtyFive.setDate(sixtyFive.getDate() - 65);
    const r = deadlineChecker(
      {
        jurisdiction: "se",
        area_of_law: "unfair_dismissal",
        facts: { dismissal_date: sixtyFive.toISOString().slice(0, 10) },
      },
      SE_EMPLOYMENT_CONTEXT
    );
    expect(r.rule_hits).toContain("limitation_likely_expired");
  });
});

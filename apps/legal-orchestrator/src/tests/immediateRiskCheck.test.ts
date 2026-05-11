import { describe, it, expect } from "vitest";
import { classifyRequest } from "../pipeline/classifyRequest";
import { immediateRiskCheck } from "../pipeline/immediateRiskCheck";

describe("immediateRiskCheck", () => {
  it("asks for dismissal_date when unfair dismissal and date missing", () => {
    const c = classifyRequest({ question: "Can I claim unfair dismissal?" });
    const r = immediateRiskCheck({ classification: c, facts: {} });
    expect(r.status).toBe("needs_more_facts");
    expect(r.missing_facts).toContain("dismissal_date");
  });

  it("flags qualifying service issue when under 2 years for unfair dismissal", () => {
    const c = classifyRequest({ question: "Can I claim unfair dismissal after 18 months?" });
    const r = immediateRiskCheck({
      classification: c,
      facts: {
        employment_start_date: "2024-01-01",
        dismissal_date: "2025-07-01",
      },
    });
    expect(r.rule_hits).toContain("qualifying_service_under_2_years");
  });

  it("notes discrimination needs no qualifying service", () => {
    const c = classifyRequest({ question: "Can I bring a discrimination claim with no service?" });
    const r = immediateRiskCheck({
      classification: c,
      facts: { incident_date: "2026-04-01" },
      now: new Date("2026-04-15"),
    });
    expect(r.rule_hits).toContain("no_qualifying_service_required");
  });

  it("flags limitation imminent when dismissal ~80 days ago", () => {
    const c = classifyRequest({ question: "I was dismissed unfairly" });
    const eightyDaysAgo = new Date();
    eightyDaysAgo.setDate(eightyDaysAgo.getDate() - 80);
    const r = immediateRiskCheck({
      classification: c,
      facts: { dismissal_date: eightyDaysAgo.toISOString().slice(0, 10) },
      now: new Date(),
    });
    expect(r.rule_hits).toContain("limitation_imminent");
    expect(r.status).toBe("high_risk_deadline");
  });

  it("flags limitation expired beyond 91 days", () => {
    const c = classifyRequest({ question: "I was dismissed unfairly" });
    const longAgo = new Date();
    longAgo.setDate(longAgo.getDate() - 200);
    const r = immediateRiskCheck({
      classification: c,
      facts: { dismissal_date: longAgo.toISOString().slice(0, 10) },
      now: new Date(),
    });
    expect(r.rule_hits).toContain("limitation_likely_expired");
    expect(r.risk_level).toBe("critical");
  });

  it("flags ACAS EC required when limitation-relevant and ACAS not started", () => {
    const c = classifyRequest({ question: "Can I claim unfair dismissal?" });
    const r = immediateRiskCheck({
      classification: c,
      facts: { dismissal_date: "2026-04-01" },
      now: new Date("2026-04-15"),
    });
    expect(r.rule_hits).toContain("acas_ec_required");
  });

  it("asks for suspension_date when suspension and date missing", () => {
    const c = classifyRequest({ question: "Can my employer suspend me without telling me why?" });
    const r = immediateRiskCheck({ classification: c, facts: {} });
    expect(r.missing_facts).toContain("suspension_date");
  });
});

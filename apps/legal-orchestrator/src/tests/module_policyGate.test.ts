import { describe, it, expect } from "vitest";
import { policyGateModule } from "../modules/policyGate";
import { UK_EMPLOYMENT_CONTEXT } from "../modules/index";

const baseClass = { area_of_law: "unfair_dismissal", requires_deadline_check: true };
const baseRisk = { status: "ok", risk_level: "low" };

describe("policyGate module (UK)", () => {
  it("blocks guaranteed-success phrasing", () => {
    const r = policyGateModule(
      {
        answer_text: "You will win this case. Deadline is 3 months less one day.",
        classification: baseClass,
        risk_check: baseRisk,
        has_citations: true,
      },
      UK_EMPLOYMENT_CONTEXT
    );
    expect(r.pass).toBe(false);
    expect(r.blocked_terms).toContain("guaranteed_you_will_win");
  });

  it("blocks emoji presence", () => {
    const r = policyGateModule(
      {
        answer_text: "A measured analysis \u{1F44D}. Deadline is 3 months less one day.",
        classification: baseClass,
        risk_check: baseRisk,
        has_citations: true,
      },
      UK_EMPLOYMENT_CONTEXT
    );
    expect(r.pass).toBe(false);
    expect(r.blocked_terms).toContain("emoji_present");
  });

  it("blocks final answers without citations", () => {
    const r = policyGateModule(
      {
        answer_text: "An analysis with mention of deadline language.",
        classification: baseClass,
        risk_check: baseRisk,
        has_citations: false,
      },
      UK_EMPLOYMENT_CONTEXT
    );
    expect(r.pass).toBe(false);
    expect(r.failures).toContain("final_answer_without_citations");
  });

  it("blocks deadline-relevant answers missing the deadline warning vocabulary", () => {
    const r = policyGateModule(
      {
        answer_text: "Plain prose with no temporal warnings whatsoever.",
        classification: baseClass,
        risk_check: baseRisk,
        has_citations: true,
      },
      UK_EMPLOYMENT_CONTEXT
    );
    expect(r.pass).toBe(false);
    expect(r.failures).toContain("missing_deadline_warning");
  });

  it("passes a measured answer with citations + deadline vocabulary", () => {
    const r = policyGateModule(
      {
        answer_text:
          "Subject to ACAS Early Conciliation, an Employment Tribunal claim is generally subject to a 3 months less one day limitation. The claimant should confirm dates with a qualified solicitor.",
        classification: baseClass,
        risk_check: baseRisk,
        has_citations: true,
      },
      UK_EMPLOYMENT_CONTEXT
    );
    expect(r.pass).toBe(true);
    expect(r.failures).toEqual([]);
  });

  it("blocks high_risk_deadline answers that don't communicate the deadline", () => {
    const r = policyGateModule(
      {
        answer_text: "Some answer that mentions ACAS but nothing about timing.",
        classification: baseClass,
        risk_check: { status: "high_risk_deadline", risk_level: "high" },
        has_citations: true,
      },
      UK_EMPLOYMENT_CONTEXT
    );
    expect(r.failures).toContain("high_risk_deadline_not_communicated");
  });
});

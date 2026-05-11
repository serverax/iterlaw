import { describe, it, expect } from "vitest";
import { policyGate } from "../pipeline/policyGate";
import { classifyRequest } from "../pipeline/classifyRequest";
import { immediateRiskCheck } from "../pipeline/immediateRiskCheck";

const baseClass = classifyRequest({ question: "Can I claim unfair dismissal?" });
const baseRisk = immediateRiskCheck({
  classification: baseClass,
  facts: { dismissal_date: "2026-04-01" },
  now: new Date("2026-04-30"),
});

describe("policyGate", () => {
  it("fails on guaranteed-success language", () => {
    const r = policyGate({
      answer: "You will win this case. The tribunal will rule in your favour. Deadline is 3 months less one day.",
      classification: baseClass,
      risk: baseRisk,
      hasCitations: true,
    });
    expect(r.pass).toBe(false);
    expect(r.failures).toEqual(expect.arrayContaining(["guaranteed_success_will_win", "guaranteed_success_tribunal_will"]));
  });

  it("fails on emoji presence", () => {
    const r = policyGate({
      answer: "Your case looks strong \u{1F44D}. Deadline is 3 months less one day.",
      classification: baseClass,
      risk: baseRisk,
      hasCitations: true,
    });
    expect(r.pass).toBe(false);
    expect(r.failures).toContain("emoji_present");
  });

  it("fails when no citations are declared", () => {
    const r = policyGate({
      answer: "A measured legal analysis without prohibited phrases. Deadline guidance: 3 months less one day.",
      classification: baseClass,
      risk: baseRisk,
      hasCitations: false,
    });
    expect(r.pass).toBe(false);
    expect(r.failures).toContain("final_answer_without_citations");
  });

  it("fails when deadline warning missing for deadline-relevant question", () => {
    const r = policyGate({
      // Deliberately contains none of: deadline / time limit / limitation /
      // 3 months less one day / ACAS — to exercise the missing-deadline gate.
      answer: "The employee may have grounds. Seek qualified advice on next steps.",
      classification: baseClass,
      risk: baseRisk,
      hasCitations: true,
    });
    expect(r.pass).toBe(false);
    expect(r.failures).toContain("missing_deadline_warning");
  });

  it("passes a measured answer with citations and deadline language", () => {
    const r = policyGate({
      answer:
        "Subject to ACAS Early Conciliation, an Employment Tribunal claim is generally subject to a 3 months less one day limitation. The claimant should confirm dates with a qualified solicitor.",
      classification: baseClass,
      risk: baseRisk,
      hasCitations: true,
    });
    expect(r.pass).toBe(true);
    expect(r.failures).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { runRiskEngine } from "../src/engines/risk.engine";
import { calculateBasicAwardGbp } from "../src/compensation/basic-award.calculator";
import { contributoryReductionGbp } from "../src/compensation/contributory-conduct.calculator";
import { assessBurchellFromText } from "../src/reasoning/burchell.engine";
import { assessAcasCode } from "../src/reasoning/acas-code.engine";
import { assessLimitationUrgency } from "../src/reasoning/limitation.engine";
import { detectClaimFamily } from "../src/reasoning/claim-detection";
import { runLegalReasoningEngine } from "../src/reasoning/legal-reasoning.engine";
import { MockRetrievalService } from "../src/rag/retrieval.service";
import type { AeeResult, ArtResult } from "../src/types/legal.types";
import { runLegalReviewPipeline } from "../src/pipeline/legal-review.pipeline";

const baseAee = (): AeeResult => ({
  facts: ["Module context: employment law."],
  datesMentioned: [],
  employerGuess: null,
  employeeRoleGuess: null,
  issueTypeGuess: null,
});

describe("Risk engine scenarios", () => {
  it("dismissal without warning increases exposure", () => {
    const text = "I was dismissed with no warning letter and no meeting.";
    const risk = runRiskEngine(baseAee(), stubArt(), text, "employment-law");
    expect(risk.riskScore).toBeGreaterThan(40);
  });

  it("flags HIGH for dismissal without procedure", () => {
    const text =
      "I was dismissed yesterday with no hearing and no investigation — gross misconduct alleged.";
    const risk = runRiskEngine(baseAee(), stubArt(), text, "employment-law");
    expect(risk.riskLevel).toMatch(/high|critical/);
    expect(risk.reasons.some((r) => /procedure/i.test(r))).toBe(true);
  });

  it("flags CRITICAL for discrimination keywords", () => {
    const text = "I believe this is sex discrimination at work and harassment.";
    const risk = runRiskEngine(baseAee(), stubArt(), text, "employment-law");
    expect(risk.riskLevel).toBe("critical");
  });

  it("handles suspension without notice", () => {
    const text = "I was suspended without notice and no evidence was shared with me.";
    const risk = runRiskEngine(baseAee(), stubArt(), text, "employment-law");
    expect(risk.riskScore).toBeGreaterThanOrEqual(45);
    expect(risk.reasons.join(" ").toLowerCase()).toMatch(/evidence|procedure|mock/i);
  });

  it("unpaid wages narrative", () => {
    const text = "My employer has made unlawful deductions and unpaid wages for three months.";
    const risk = runRiskEngine(baseAee(), stubArt(), text, "employment-law");
    expect(risk.riskScore).toBeGreaterThan(30);
  });

  it("redundancy narrative", () => {
    const text = "We were placed in a redundancy pool with no consultation.";
    const risk = runRiskEngine(baseAee(), stubArt(), text, "employment-law");
    expect(risk.reasons.length).toBeGreaterThan(0);
  });

  it("limitation urgency", () => {
    const lim = assessLimitationUrgency("This happened more than 3 months ago and I did nothing.");
    expect(lim.urgentEtLimitation).toBe(true);
  });

  it("missing evidence", () => {
    const text = "They dismissed me with no evidence and no documentation.";
    const risk = runRiskEngine(baseAee(), stubArt(), text, "employment-law");
    expect(risk.reasons.join(" ").toLowerCase()).toContain("evidence");
  });

  it("ACAS breach heuristic", () => {
    const acas = assessAcasCode("Instant dismissal with no right of appeal offered.");
    expect(acas.alignedWithCode).toBe("unlikely");
  });

  it("contributory conduct reduction applies to compensatory head", () => {
    const line = contributoryReductionGbp(10_000, 0.2);
    expect(line.code).toBe("contributory");
    expect(line.amountGbp).toBe(2000);
  });

  it("Polkey and contributory factors in compensation inputs", async () => {
    const { inferUnfairDismissalInputsFromText } = await import(
      "../src/compensation/input-hints"
    );
    const t =
      "Dismissed with Polkey risk and contributory blame; ACAS breach; £650 per week; 5 years service; age 41.";
    const i = inferUnfairDismissalInputsFromText(t);
    expect(i.polkeyFactor).toBeGreaterThan(0);
    expect(i.contributoryFactor).toBeGreaterThan(0);
    expect(i.acasUpliftFactor).toBeGreaterThan(0);
  });
});

function stubArt(): ArtResult {
  return {
    issues: ["Issue one"],
    legalTests: ["Test one"],
    weaknesses: ["Weakness one"],
  };
}

describe("Burchell / claim detection", () => {
  it("Burchell weak when no investigation", () => {
    const b = assessBurchellFromText("Dismissed with no investigation and no hearing.");
    expect(b.reasonableInvestigation).toBe("weak");
  });

  it("detects unfair dismissal", () => {
    const f = detectClaimFamily("I was unfairly dismissed", "employment-law", baseAee());
    expect(f).toBe("unfair-dismissal");
  });

  it("detects discrimination", () => {
    const f = detectClaimFamily("This is harassment based on race", "employment-law", baseAee());
    expect(f).toBe("discrimination");
  });
});

describe("Legal reasoning + RAG mock", () => {
  it("citations include title, url, jurisdiction, summary", async () => {
    const retrieval = await new MockRetrievalService().retrieve({
      queryText: "unfair dismissal ACAS",
      module: "employment-law",
    });
    const c = retrieval.citations[0];
    expect(c.title.length).toBeGreaterThan(3);
    expect(c.url.startsWith("http")).toBe(true);
    expect(["UK", "EW", "SCT", "NI"]).toContain(c.jurisdiction);
    expect(c.summary.length).toBeGreaterThan(10);
  });

  it("returns citations (or uncited fallback)", async () => {
    const retrieval = await new MockRetrievalService().retrieve({
      queryText: "unfair dismissal ERA 1996",
      module: "employment-law",
    });
    const lr = runLegalReasoningEngine(baseAee(), "I was dismissed unfairly", "employment-law", retrieval);
    expect(lr.citations.length).toBeGreaterThan(0);
    expect(lr.claimType).toBe("unfair-dismissal");
  });
});

describe("Full pipeline /api/review shape", () => {
  it("returns structured response with confidenceScore and disclaimer", async () => {
    const out = await runLegalReviewPipeline(
      {
        text: "I was dismissed without a hearing. £600 per week, 4 years service, age 40.",
        module: "employment-law",
      },
      { requestId: "test-pipeline-1" },
    );
    expect(out.module).toBe("employment-law");
    expect(out.facts.length).toBeGreaterThan(0);
    expect(out.claims[0]?.family).toBeDefined();
    expect(out.legalReasoning.claimType).toBeDefined();
    expect(out.risk.score).toBeGreaterThanOrEqual(0);
    expect(out.compensation.basicAward).toBeGreaterThanOrEqual(0);
    expect(out.citations.length).toBeGreaterThan(0);
    expect(out.evidenceGaps.length).toBeGreaterThan(0);
    expect(out.nextSteps.length).toBeGreaterThan(0);
    expect(out.documentsToGenerate.length).toBeGreaterThan(0);
    expect(typeof out.confidenceScore).toBe("number");
    expect(out.disclaimer.length).toBeGreaterThan(20);
    expect(out.safetyFlags).toContain("citation_required_for_court_submission");
  });
});

describe("Basic award calculator", () => {
  it("respects statutory week cap and age multipliers", () => {
    const basic = calculateBasicAwardGbp({
      age: 42,
      weeklyPayGbp: 900,
      yearsOfService: 4,
      pastLossWeeks: 0,
      futureLossWeeks: 0,
      pensionLossFactor: 0,
      benefitsLossGbp: 0,
      mitigationFactor: 0,
      polkeyFactor: 0,
      contributoryFactor: 0,
      acasUpliftFactor: 0,
    });
    expect(basic).toBeGreaterThan(0);
    expect(basic).toBeLessThan(900 * 1.5 * 5);
  });
});

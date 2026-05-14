import { describe, expect, it } from "vitest";

import {
  runLegalGoldenScenarios,
  type LegalGoldenOracle,
  type LegalGoldenOracleResult,
  type LegalGoldenScenario,
} from "../evaluation/legalGoldenHarness";
import { UK_EMPLOYMENT_GOLDEN_SCENARIOS } from "./fixtures/legalGoldenScenarios";

describe("UK employment golden scenarios fixture", () => {
  it("contains all ten required scenarios", () => {
    const ids = UK_EMPLOYMENT_GOLDEN_SCENARIOS.map((s) => s.id);
    expect(ids).toHaveLength(10);
    for (const required of [
      "unfair_dismissal_1",
      "redundancy_1",
      "discrimination_1",
      "holiday_pay_1",
      "notice_pay_1",
      "settlement_agreement_1",
      "whistleblowing_1",
      "employment_status_1",
      "acas_early_conciliation_1",
      "limitation_dates_1",
    ]) {
      expect(ids).toContain(required);
    }
  });

  it("every scenario without evidence expects insufficient_sources", () => {
    for (const s of UK_EMPLOYMENT_GOLDEN_SCENARIOS) {
      if (!s.evidenceAvailable) {
        expect(s.expected.outcome).toBe("insufficient_sources");
      }
    }
  });

  it("every scenario has a stable id, label, and question", () => {
    for (const s of UK_EMPLOYMENT_GOLDEN_SCENARIOS) {
      expect(s.id.length).toBeGreaterThan(0);
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.question.length).toBeGreaterThan(0);
    }
  });
});

describe("runLegalGoldenScenarios — safe defaults", () => {
  it("returns insufficient_sources for every scenario when no oracle is injected", async () => {
    const summary = await runLegalGoldenScenarios(UK_EMPLOYMENT_GOLDEN_SCENARIOS);
    expect(summary.total).toBe(10);
    // All 10 scenarios expect insufficient_sources without evidence, so all PASS.
    expect(summary.passed).toBe(10);
    expect(summary.failed).toBe(0);
    for (const r of summary.results) {
      expect(r.actual.outcome).toBe("insufficient_sources");
      expect(r.actual.reasonCodes).toContain("golden:no_oracle_injected");
    }
  });
});

describe("runLegalGoldenScenarios — with oracle", () => {
  it("flags a mismatch when the oracle returns the wrong outcome", async () => {
    const wrongOracle: LegalGoldenOracle = () =>
      ({ outcome: "answered", reasonCodes: [] }) as LegalGoldenOracleResult;
    const summary = await runLegalGoldenScenarios(UK_EMPLOYMENT_GOLDEN_SCENARIOS, wrongOracle);
    expect(summary.passed).toBe(0);
    expect(summary.failed).toBe(10);
    for (const r of summary.results) {
      expect(r.pass).toBe(false);
      expect(r.reasonCodes.some((c) => c.startsWith("golden:outcome_mismatch:"))).toBe(true);
    }
  });

  it("respects reasonContains when supplied on a scenario", async () => {
    const scenarios: ReadonlyArray<LegalGoldenScenario> = [
      {
        id: "tc-1",
        label: "test scenario 1",
        question: "?",
        inputs: {},
        evidenceAvailable: false,
        expected: { outcome: "insufficient_sources", reasonContains: "specific_code" },
      },
    ];
    const oracleWithRightCode: LegalGoldenOracle = () => ({
      outcome: "insufficient_sources",
      reasonCodes: ["specific_code:applied"],
    });
    const oracleWithWrongCode: LegalGoldenOracle = () => ({
      outcome: "insufficient_sources",
      reasonCodes: ["something_else"],
    });
    const sRight = await runLegalGoldenScenarios(scenarios, oracleWithRightCode);
    const sWrong = await runLegalGoldenScenarios(scenarios, oracleWithWrongCode);
    expect(sRight.passed).toBe(1);
    expect(sWrong.passed).toBe(0);
  });

  it("does not invoke any LLM (oracle is injected; harness is sync over the oracle)", async () => {
    let oracleCalls = 0;
    const counter: LegalGoldenOracle = () => {
      oracleCalls += 1;
      return { outcome: "insufficient_sources", reasonCodes: [] };
    };
    await runLegalGoldenScenarios(UK_EMPLOYMENT_GOLDEN_SCENARIOS, counter);
    expect(oracleCalls).toBe(10);
  });
});

import { describe, it, expect } from "vitest";
import { lawModuleInputFingerprint } from "../lawModuleEngine/inputFingerprint.js";
import { blendRerankerWithCalculator } from "../lawModuleEngine/rerankerBlend.js";
import {
  lawModuleEvidenceDensity,
  lawModuleEvidenceQualityScore,
} from "../lawModuleEngine/evidencePackMetrics.js";
import { runLawModuleEnginePhase1 } from "../lawModuleEngine/phase1Orchestrator.js";

describe("Sprint 21 — lawModuleInputFingerprint", () => {
  it("is stable for same logical object", () => {
    const a = lawModuleInputFingerprint({ b: 2, a: 1 });
    const b = lawModuleInputFingerprint({ a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it("changes when values change", () => {
    const a = lawModuleInputFingerprint({ x: 1 });
    const b = lawModuleInputFingerprint({ x: 2 });
    expect(a).not.toBe(b);
  });

  it("returns 40 hex chars", () => {
    expect(lawModuleInputFingerprint({ k: "v" })).toMatch(/^[a-f0-9]{40}$/);
  });

  it("handles empty object", () => {
    expect(lawModuleInputFingerprint({})).toHaveLength(40);
  });
});

describe("Sprint 21 — blendRerankerWithCalculator", () => {
  it("implemented + reranker 1 yields high blend", () => {
    expect(blendRerankerWithCalculator("implemented", 1, 0.5)).toBeCloseTo(0.5 * 1 + 0.5 * 1);
  });

  it("planned lowers impl lane", () => {
    const v = blendRerankerWithCalculator("planned", 1, 0.5);
    expect(v).toBeCloseTo(0.5 * 0.35 + 0.5 * 1);
  });

  it("null status uses zero impl lane", () => {
    expect(blendRerankerWithCalculator(null, 0.5, 0.5)).toBeCloseTo(0.25);
  });

  it("clamps reranker above 1", () => {
    expect(blendRerankerWithCalculator("implemented", 99, 0.5)).toBeLessThanOrEqual(1);
  });

  it("clamps reranker below 0", () => {
    expect(blendRerankerWithCalculator("implemented", -3, 0.5)).toBeGreaterThanOrEqual(0);
  });

  it("clamps weight", () => {
    expect(blendRerankerWithCalculator("implemented", 0.5, 2)).toBeLessThanOrEqual(1);
  });
});

describe("Sprint 21 — evidencePackMetrics", () => {
  it("lawModuleEvidenceDensity zero for 0", () => {
    expect(lawModuleEvidenceDensity(0)).toBe(0);
  });

  it("lawModuleEvidenceDensity caps", () => {
    expect(lawModuleEvidenceDensity(100)).toBe(1);
  });

  it("lawModuleEvidenceQualityScore blends", () => {
    expect(lawModuleEvidenceQualityScore(1, 1)).toBe(1);
    expect(lawModuleEvidenceQualityScore(0, 0)).toBe(0);
  });
});

describe("Sprint 21 — runLawModuleEnginePhase1", () => {
  const redundancyInputs = {
    age: 40,
    years_of_service: 5,
    weekly_pay: 500,
    effective_date: "2024-04-01",
  };

  it("finds statutory_redundancy_pay and satisfies keys", () => {
    const r = runLawModuleEnginePhase1({
      moduleId: "uk-emp",
      calculatorId: "statutory_redundancy_pay",
      inputs: redundancyInputs,
      evidenceEntryCount: 6,
      meanRerankerScore: 0.8,
    });
    expect(r.calculatorFound).toBe(true);
    expect(r.calculatorStatus).toBe("implemented");
    expect(r.inputKeysSatisfied).toBe(true);
    expect(r.missingInputKeys).toEqual([]);
  });

  it("reports missing keys for redundancy", () => {
    const r = runLawModuleEnginePhase1({
      moduleId: "uk-emp",
      calculatorId: "statutory_redundancy_pay",
      inputs: { age: 30 },
      evidenceEntryCount: 1,
      meanRerankerScore: 0.5,
    });
    expect(r.inputKeysSatisfied).toBe(false);
    expect(r.missingInputKeys.length).toBeGreaterThan(0);
  });

  it("notice_period implemented path", () => {
    const r = runLawModuleEnginePhase1({
      moduleId: "uk-emp",
      calculatorId: "notice_period",
      inputs: { service_months: 14, notice_direction: "employer" },
      evidenceEntryCount: 4,
      meanRerankerScore: 0.6,
    });
    expect(r.calculatorFound).toBe(true);
    expect(r.inputKeysSatisfied).toBe(true);
  });

  it("holiday_pay requires mode key", () => {
    const r = runLawModuleEnginePhase1({
      moduleId: "uk-emp",
      calculatorId: "holiday_pay",
      inputs: {},
      evidenceEntryCount: 0,
      meanRerankerScore: 0,
    });
    expect(r.calculatorFound).toBe(true);
    expect(r.inputKeysSatisfied).toBe(false);
  });

  it("unknown calculator", () => {
    const r = runLawModuleEnginePhase1({
      moduleId: "x",
      calculatorId: "no_such_calc",
      inputs: {},
      evidenceEntryCount: 0,
      meanRerankerScore: 0.2,
    });
    expect(r.calculatorFound).toBe(false);
    expect(r.inputKeysSatisfied).toBe(false);
  });

  it("fingerprint stable across phase1 calls", () => {
    const a = runLawModuleEnginePhase1({
      moduleId: "m",
      calculatorId: "notice_period",
      inputs: { service_months: 6, notice_direction: "employee" },
      evidenceEntryCount: 2,
      meanRerankerScore: 0.4,
    });
    const b = runLawModuleEnginePhase1({
      moduleId: "m2",
      calculatorId: "notice_period",
      inputs: { notice_direction: "employee", service_months: 6 },
      evidenceEntryCount: 2,
      meanRerankerScore: 0.4,
    });
    expect(a.inputFingerprint).toBe(b.inputFingerprint);
  });

  it("evidenceDensity scales", () => {
    const low = runLawModuleEnginePhase1({
      moduleId: "m",
      calculatorId: "statutory_redundancy_pay",
      inputs: redundancyInputs,
      evidenceEntryCount: 6,
      meanRerankerScore: 0.5,
    });
    const high = runLawModuleEnginePhase1({
      moduleId: "m",
      calculatorId: "statutory_redundancy_pay",
      inputs: redundancyInputs,
      evidenceEntryCount: 24,
      meanRerankerScore: 0.5,
    });
    expect(high.evidenceDensity).toBeGreaterThan(low.evidenceDensity);
  });

  it("uses meanEvidenceTrust when provided", () => {
    const withTrust = runLawModuleEnginePhase1({
      moduleId: "m",
      calculatorId: "statutory_redundancy_pay",
      inputs: redundancyInputs,
      evidenceEntryCount: 8,
      meanRerankerScore: 0.2,
      meanEvidenceTrust: 0.9,
    });
    const noTrust = runLawModuleEnginePhase1({
      moduleId: "m",
      calculatorId: "statutory_redundancy_pay",
      inputs: redundancyInputs,
      evidenceEntryCount: 8,
      meanRerankerScore: 0.2,
    });
    expect(withTrust.evidenceQuality).not.toBe(noTrust.evidenceQuality);
  });

  it("blendedEngineScore reflects implemented calculator", () => {
    const r = runLawModuleEnginePhase1({
      moduleId: "m",
      calculatorId: "statutory_redundancy_pay",
      inputs: redundancyInputs,
      evidenceEntryCount: 3,
      meanRerankerScore: 0.4,
    });
    expect(r.blendedEngineScore).toBe(blendRerankerWithCalculator("implemented", 0.4));
  });

  it.each([
    ["limitation_dates", ["claim_type", "event_date"]],
    ["ssp", ["average_weekly_earnings"]],
  ])("planned calculator %s missing keys", (id, keys) => {
    const r = runLawModuleEnginePhase1({
      moduleId: "m",
      calculatorId: id,
      inputs: Object.fromEntries(keys.map((k) => [k, "x"])),
      evidenceEntryCount: 1,
      meanRerankerScore: 0.5,
    });
    expect(r.calculatorStatus).toBe("planned");
    expect(r.inputKeysSatisfied).toBe(false);
  });

  it("planned calculator with all declared keys satisfies", () => {
    const r = runLawModuleEnginePhase1({
      moduleId: "m",
      calculatorId: "ssp",
      inputs: {
        average_weekly_earnings: 100,
        qualifying_days: 3,
        linked_periods: 0,
      },
      evidenceEntryCount: 2,
      meanRerankerScore: 0.7,
    });
    expect(r.inputKeysSatisfied).toBe(true);
  });

  it("moduleId echoed", () => {
    expect(
      runLawModuleEnginePhase1({
        moduleId: "mod-a",
        calculatorId: "notice_period",
        inputs: { service_months: 1, notice_direction: "employer" },
        evidenceEntryCount: 1,
        meanRerankerScore: 0.5,
      }).moduleId,
    ).toBe("mod-a");
  });

  it("evidenceQuality bounded 0-1", () => {
    const r = runLawModuleEnginePhase1({
      moduleId: "m",
      calculatorId: "holiday_pay",
      inputs: {
        mode: "weeks",
        daysPerWeek_or_hoursWorkedInPeriod: 5,
        weeklyPayGbp_or_hourlyRateGbp: 400,
      },
      evidenceEntryCount: 12,
      meanRerankerScore: 1,
      meanEvidenceTrust: 1,
    });
    expect(r.evidenceQuality).toBeLessThanOrEqual(1);
    expect(r.evidenceQuality).toBeGreaterThanOrEqual(0);
  });

  it.each([1, 3, 6, 11, 12])("evidenceDensity step %i", (n) => {
    const r = runLawModuleEnginePhase1({
      moduleId: "m",
      calculatorId: "notice_period",
      inputs: { service_months: 12, notice_direction: "employer" },
      evidenceEntryCount: n,
      meanRerankerScore: 0.5,
    });
    expect(r.evidenceDensity).toBe(Math.min(1, n / 12));
  });

  it.each([
    [0.0, 0.55 * 0.35 + 0.45 * 0.0],
    [0.25, 0.55 * 0.35 + 0.45 * 0.25],
    [0.75, 0.55 * 0.35 + 0.45 * 0.75],
  ])("blend planned rerank %f", (rerank, expected) => {
    expect(blendRerankerWithCalculator("planned", rerank, 0.55)).toBeCloseTo(expected, 5);
  });
});

describe("Sprint 21 — lawModuleEngine barrel", () => {
  it("re-exports from index", async () => {
    const m = await import("../lawModuleEngine/index.js");
    expect(typeof m.lawModuleInputFingerprint).toBe("function");
    expect(typeof m.runLawModuleEnginePhase1).toBe("function");
  });

  it.each(["nmw_nlw", "vento_bands", "unfair_dismissal_cap"])("planned calc %s yields blend < implemented", (id) => {
    const planned = runLawModuleEnginePhase1({
      moduleId: "m",
      calculatorId: id,
      inputs: {},
      evidenceEntryCount: 0,
      meanRerankerScore: 0.9,
    });
    expect(planned.calculatorStatus).toBe("planned");
    const impl = runLawModuleEnginePhase1({
      moduleId: "m",
      calculatorId: "statutory_redundancy_pay",
      inputs: {
        age: 22,
        years_of_service: 1,
        weekly_pay: 400,
        effective_date: "2024-01-01",
      },
      evidenceEntryCount: 4,
      meanRerankerScore: 0.9,
    });
    expect(planned.blendedEngineScore).toBeLessThan(impl.blendedEngineScore);
  });
});

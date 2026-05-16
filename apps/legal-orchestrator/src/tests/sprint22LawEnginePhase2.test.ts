import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  anonymizeLawCaseInput,
  calculateZone1LegalPositionScore,
  fuseLawEngineResults,
  deAnonymizeLawResult,
  LawEnginePhase2Band,
  resetLawCaseAnonymizerCounters,
  situationFingerprint,
} from "../coherentSystem/lawEnginePhase2.js";
import { Zone2LawServiceStub } from "../coherentSystem/zone2LawStub.js";
import type { LawAnalysisResult, RawLawCasePayload, Zone2LawService } from "../coherentSystem/zone2LawTypes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql118 = readFileSync(join(__dirname, "../../db/migrations/118_sprint22_law_engine_zone2_analysis.sql"), "utf8");

describe("migration 118_sprint22_law_engine_zone2_analysis.sql", () => {
  it("creates law_engine_zone2_analysis", () => {
    expect(sql118).toMatch(/CREATE TABLE IF NOT EXISTS public\.law_engine_zone2_analysis/i);
  });
  it("stores anonymized_payload and zone2_stub_response", () => {
    expect(sql118).toMatch(/anonymized_payload/i);
    expect(sql118).toMatch(/zone2_stub_response/i);
  });
  it("situation_fingerprint column", () => {
    expect(sql118).toMatch(/situation_fingerprint/i);
  });
  it("RLS self policies", () => {
    expect(sql118).toMatch(/law_engine_zone2_analysis_self_select/i);
    expect(sql118).toMatch(/law_engine_zone2_analysis_self_insert/i);
  });
  it("admin delete policy", () => {
    expect(sql118).toMatch(/law_engine_zone2_analysis_admin_delete/i);
  });
});

describe("Sprint 22 — anonymizeLawCaseInput", () => {
  beforeEach(() => {
    resetLawCaseAnonymizerCounters();
  });

  it("replaces employee and company with tokens", () => {
    const { anonymized, tokenMap } = anonymizeLawCaseInput({
      employeeName: "Alice Smith",
      companyName: "Acme Ltd",
      situationType: "DISMISSAL",
      yearsOfService: 3,
    });
    expect(anonymized.employeeToken).toMatch(/^\[EMPLOYEE_/);
    expect(anonymized.companyToken).toMatch(/^\[COMPANY_/);
    expect(anonymized.situationType).toBe("DISMISSAL");
    expect(tokenMap.get(anonymized.employeeToken)).toBe("Alice Smith");
  });

  it("does not include raw names on anonymized object", () => {
    const { anonymized } = anonymizeLawCaseInput({
      employeeName: "Bob",
      companyName: "Globex",
      situationType: "X",
      yearsOfService: 1,
    });
    expect(JSON.stringify(anonymized)).not.toContain("Bob");
    expect(JSON.stringify(anonymized)).not.toContain("Globex");
  });

  it("handles blank names with zero tokens", () => {
    const { anonymized } = anonymizeLawCaseInput({
      employeeName: "   ",
      companyName: "",
      situationType: "Y",
      yearsOfService: 0,
    });
    expect(anonymized.employeeToken).toBe("[EMPLOYEE_0]");
    expect(anonymized.companyToken).toBe("[COMPANY_0]");
  });
});

describe("Sprint 22 — situationFingerprint", () => {
  it("deterministic for same inputs", () => {
    const a = situationFingerprint({
      employeeName: "x",
      companyName: "y",
      situationType: "REDUNDANCY",
      yearsOfService: 5,
    });
    const b = situationFingerprint({
      employeeName: "different",
      companyName: "names",
      situationType: "REDUNDANCY",
      yearsOfService: 5,
    });
    expect(a).toBe(b);
  });
});

describe("Sprint 22 — calculateZone1LegalPositionScore", () => {
  it("0 years -> 0", () => {
    expect(
      calculateZone1LegalPositionScore({
        employeeName: "",
        companyName: "",
        situationType: "S",
        yearsOfService: 0,
      }),
    ).toBe(0);
  });
  it("40+ years caps at 1", () => {
    expect(
      calculateZone1LegalPositionScore({
        employeeName: "",
        companyName: "",
        situationType: "S",
        yearsOfService: 99,
      }),
    ).toBe(1);
  });
});

describe("Sprint 22 — fuseLawEngineResults", () => {
  it("blends zone1 and zone2 confidence", () => {
    const z2: LawAnalysisResult = {
      analysisId: "id",
      confidence: 0.8,
      citations: [],
      recommendation: "R",
    };
    expect(fuseLawEngineResults(0.4, z2)).toBeCloseTo(0.45 * 0.4 + 0.55 * 0.8, 5);
  });
});

describe("Sprint 22 — deAnonymizeLawResult", () => {
  it("maps You and employer label", () => {
    const m = new Map<string, string>([
      ["[EMPLOYEE_1]", "Alice"],
      ["[COMPANY_1]", "Acme"],
    ]);
    const z2: LawAnalysisResult = {
      analysisId: "abc",
      confidence: 0.9,
      citations: [],
      recommendation: "X",
    };
    const u = deAnonymizeLawResult(z2, m, 0.77);
    expect(u.relatedTo).toBe("You");
    expect(u.employerLabel).toBe("Acme");
    expect(u.fusedScore).toBe(0.77);
  });
});

describe("Sprint 22 — Zone2LawServiceStub", () => {
  beforeEach(() => {
    resetLawCaseAnonymizerCounters();
  });

  it("returns fixed confidence", async () => {
    const stub = new Zone2LawServiceStub();
    const r = await stub.analyzeLaw({
      employeeToken: "[EMPLOYEE_1]",
      companyToken: "[COMPANY_1]",
      situationType: "DISMISSAL",
      yearsOfService: 2,
    });
    expect(r.confidence).toBe(0.87);
  });

  it("deterministic analysisId", async () => {
    const stub = new Zone2LawServiceStub();
    const a = {
      employeeToken: "[EMPLOYEE_1]",
      companyToken: "[COMPANY_1]",
      situationType: "DISMISSAL",
      yearsOfService: 2,
    };
    const r1 = await stub.analyzeLaw(a);
    const r2 = await stub.analyzeLaw(a);
    expect(r1.analysisId).toBe(r2.analysisId);
  });
});

describe("Sprint 22 — LawEnginePhase2Band integration", () => {
  beforeEach(() => {
    resetLawCaseAnonymizerCounters();
  });

  it("end-to-end analyze", async () => {
    const band = new LawEnginePhase2Band(new Zone2LawServiceStub());
    const raw: RawLawCasePayload = {
      employeeName: "Jane",
      companyName: "Contoso",
      situationType: "UNFAIR_DISMISSAL",
      yearsOfService: 10,
    };
    const out = await band.analyze(raw);
    expect(out.relatedTo).toBe("You");
    expect(out.employerLabel).toBe("Contoso");
    expect(out.confidence).toBe(0.87);
    expect(out.fusedScore).toBeGreaterThan(0);
    expect(out.fusedScore).toBeLessThanOrEqual(1);
  });

  it("uses injected Zone2 implementation", async () => {
    const custom: Zone2LawService = {
      async analyzeLaw() {
        return {
          analysisId: "fixed",
          confidence: 0.5,
          citations: [],
          recommendation: "OK",
        };
      },
    };
    const band = new LawEnginePhase2Band(custom);
    const out = await band.analyze({
      employeeName: "A",
      companyName: "B",
      situationType: "S",
      yearsOfService: 20,
    });
    expect(out.analysisId).toBe("fixed");
    expect(out.confidence).toBe(0.5);
  });
});

describe("Sprint 22 — counter isolation", () => {
  beforeEach(() => {
    resetLawCaseAnonymizerCounters();
  });

  it("increments employee tokens across calls", () => {
    const a = anonymizeLawCaseInput({
      employeeName: "E1",
      companyName: "C",
      situationType: "S",
      yearsOfService: 1,
    });
    const b = anonymizeLawCaseInput({
      employeeName: "E2",
      companyName: "C",
      situationType: "S",
      yearsOfService: 1,
    });
    expect(a.anonymized.employeeToken).not.toBe(b.anonymized.employeeToken);
  });
});

describe("Sprint 22 — zone1 score monotonicity", () => {
  it.each([0, 1, 5, 10, 20, 40])("years %i", (years) => {
    const s = calculateZone1LegalPositionScore({
      employeeName: "",
      companyName: "",
      situationType: "S",
      yearsOfService: years,
    });
    expect(s).toBe(Math.min(1, years / 40));
  });
});

describe("Sprint 22 — fuse edge cases", () => {
  it("zone2 confidence 0", () => {
    const z2: LawAnalysisResult = {
      analysisId: "x",
      confidence: 0,
      citations: [],
      recommendation: "r",
    };
    expect(fuseLawEngineResults(1, z2)).toBeCloseTo(0.45, 5);
  });

  it("zone1 0 zone2 1", () => {
    const z2: LawAnalysisResult = {
      analysisId: "x",
      confidence: 1,
      citations: [],
      recommendation: "r",
    };
    expect(fuseLawEngineResults(0, z2)).toBeCloseTo(0.55, 5);
  });
});

describe("Sprint 22 — lawEnginePhase2Band default export wiring", () => {
  beforeEach(() => {
    resetLawCaseAnonymizerCounters();
  });

  it("module default band runs", async () => {
    const { lawEnginePhase2Band } = await import("../coherentSystem/index.js");
    const out = await lawEnginePhase2Band.analyze({
      employeeName: "Pat",
      companyName: "Co",
      situationType: "GRIEVANCE",
      yearsOfService: 4,
    });
    expect(out.recommendation).toBe("ESCALATE_TO_SOLICITOR");
  });
});

describe("Sprint 22 — stub citation shape", () => {
  beforeEach(() => {
    resetLawCaseAnonymizerCounters();
  });

  it.each(Array.from({ length: 15 }, (_, i) => i))("stub citations %i", async (i) => {
    const stub = new Zone2LawServiceStub();
    const r = await stub.analyzeLaw({
      employeeToken: `[EMPLOYEE_${i}]`,
      companyToken: `[COMPANY_${i}]`,
      situationType: `T${i}`,
      yearsOfService: i,
    });
    expect(r.citations.length).toBeGreaterThanOrEqual(2);
    expect(r.recommendation).toBe("ESCALATE_TO_SOLICITOR");
  });
});

describe("Sprint 22 — anonymize token uniqueness grid", () => {
  beforeEach(() => {
    resetLawCaseAnonymizerCounters();
  });

  it.each(Array.from({ length: 12 }, (_, i) => i))("unique tokens iteration %i", (i) => {
    const { anonymized } = anonymizeLawCaseInput({
      employeeName: `User${i}`,
      companyName: `Org${i}`,
      situationType: "S",
      yearsOfService: 1,
    });
    expect(anonymized.employeeToken).not.toContain(`User${i}`);
    expect(anonymized.companyToken).not.toContain(`Org${i}`);
  });
});

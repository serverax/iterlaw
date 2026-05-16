import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LawEnginePhase3Band,
  riskBandFromFusedScore,
} from "../coherentSystem/lawEnginePhase3.js";
import { resetLawCaseAnonymizerCounters } from "../coherentSystem/lawEnginePhase2.js";
import { Zone2LawServiceStub } from "../coherentSystem/zone2LawStub.js";
import type { AnonymizedLawCaseInput, RawLawCasePayload, Zone2LawService } from "../coherentSystem/zone2LawTypes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql119 = readFileSync(join(__dirname, "../../db/migrations/119_sprint23_law_engine_phase3.sql"), "utf8");

describe("migration 119_sprint23_law_engine_phase3.sql", () => {
  it("creates law_engine_phase3_refinement_audit", () => {
    expect(sql119).toMatch(/CREATE TABLE IF NOT EXISTS public\.law_engine_phase3_refinement_audit/i);
  });
  it("stores fused_score and risk_band", () => {
    expect(sql119).toMatch(/fused_score/i);
    expect(sql119).toMatch(/risk_band/i);
  });
  it("CHECK constraint on risk_band", () => {
    expect(sql119).toMatch(/CHECK \(risk_band IN \('LOW', 'MEDIUM', 'HIGH'\)\)/i);
  });
  it("RLS enabled", () => {
    expect(sql119).toMatch(/ENABLE ROW LEVEL SECURITY/i);
  });
  it("self select and insert policies", () => {
    expect(sql119).toMatch(/law_engine_phase3_refinement_self_select/i);
    expect(sql119).toMatch(/law_engine_phase3_refinement_self_insert/i);
  });
  it("admin delete policy", () => {
    expect(sql119).toMatch(/law_engine_phase3_refinement_admin_delete/i);
  });
});

describe("Sprint 23 — riskBandFromFusedScore", () => {
  it("LOW below 0.35", () => {
    expect(riskBandFromFusedScore(0)).toBe("LOW");
    expect(riskBandFromFusedScore(0.34)).toBe("LOW");
  });
  it("MEDIUM at 0.35 through below 0.65", () => {
    expect(riskBandFromFusedScore(0.35)).toBe("MEDIUM");
    expect(riskBandFromFusedScore(0.5)).toBe("MEDIUM");
    expect(riskBandFromFusedScore(0.64)).toBe("MEDIUM");
  });
  it("HIGH from 0.65", () => {
    expect(riskBandFromFusedScore(0.65)).toBe("HIGH");
    expect(riskBandFromFusedScore(1)).toBe("HIGH");
  });
  it("clamps below zero", () => {
    expect(riskBandFromFusedScore(-1)).toBe("LOW");
  });
  it("clamps above one", () => {
    expect(riskBandFromFusedScore(2)).toBe("HIGH");
  });
});

describe("Sprint 23 — risk band grid", () => {
  it.each([
    [0.1, "LOW"],
    [0.2, "LOW"],
    [0.34, "LOW"],
    [0.35, "MEDIUM"],
    [0.4, "MEDIUM"],
    [0.64, "MEDIUM"],
    [0.65, "HIGH"],
    [0.9, "HIGH"],
  ])("fused %s -> %s", (fused, band) => {
    expect(riskBandFromFusedScore(fused as number)).toBe(band);
  });
});

describe("Sprint 23 — Zone2LawServiceStub refineLawBand", () => {
  it("matches riskBandFromFusedScore", async () => {
    const stub = new Zone2LawServiceStub();
    const input: AnonymizedLawCaseInput = {
      employeeToken: "[EMPLOYEE_1]",
      companyToken: "[COMPANY_1]",
      situationType: "X",
      yearsOfService: 2,
    };
    for (const fused of [0.1, 0.5, 0.9]) {
      const r = await stub.refineLawBand(input, fused);
      expect(r.riskBand).toBe(riskBandFromFusedScore(fused));
    }
  });

  it("deterministic refinementId for same inputs", async () => {
    const stub = new Zone2LawServiceStub();
    const input: AnonymizedLawCaseInput = {
      employeeToken: "[EMPLOYEE_1]",
      companyToken: "[COMPANY_1]",
      situationType: "DISMISSAL",
      yearsOfService: 3,
    };
    const a = await stub.refineLawBand(input, 0.5);
    const b = await stub.refineLawBand(input, 0.5);
    expect(a.refinementId).toBe(b.refinementId);
  });

  it("summary contains situation type only (token-safe path)", async () => {
    const stub = new Zone2LawServiceStub();
    const r = await stub.refineLawBand(
      {
        employeeToken: "[EMPLOYEE_1]",
        companyToken: "[COMPANY_1]",
        situationType: "GRIEVANCE",
        yearsOfService: 1,
      },
      0.4,
    );
    expect(r.summary).toContain("GRIEVANCE");
    expect(r.summary).not.toMatch(/Alice|Bob|@/);
  });
});

describe("Sprint 23 — LawEnginePhase3Band", () => {
  beforeEach(() => {
    resetLawCaseAnonymizerCounters();
  });

  it("returns phase3 fields", async () => {
    const band = new LawEnginePhase3Band(new Zone2LawServiceStub());
    const out = await band.analyze({
      employeeName: "Sam",
      companyName: "Globex",
      situationType: "REDUNDANCY",
      yearsOfService: 8,
    });
    expect(out.relatedTo).toBe("You");
    expect(out.employerLabel).toBe("Globex");
    expect(out.refinementId.length).toBeGreaterThan(0);
    expect(["LOW", "MEDIUM", "HIGH"]).toContain(out.riskBand);
    expect(out.refinementSummary.length).toBeGreaterThan(0);
  });

  it("analyzeWithMeta returns anonymized without raw names", async () => {
    const band = new LawEnginePhase3Band(new Zone2LawServiceStub());
    const { anonymized, user } = await band.analyzeWithMeta({
      employeeName: "SecretName",
      companyName: "SecretCo",
      situationType: "S",
      yearsOfService: 2,
    });
    expect(JSON.stringify(anonymized)).not.toContain("SecretName");
    expect(JSON.stringify(anonymized)).not.toContain("SecretCo");
    expect(user.fusedScore).toBeGreaterThanOrEqual(0);
    expect(user.fusedScore).toBeLessThanOrEqual(1);
  });

  it("refineLawBand receives anonymized tokens only", async () => {
    const refine = vi.fn(async (input: AnonymizedLawCaseInput, fused: number) => {
      const stub = new Zone2LawServiceStub();
      return stub.refineLawBand(input, fused);
    });
    const zone2: Zone2LawService = {
      async analyzeLaw(input) {
        return new Zone2LawServiceStub().analyzeLaw(input);
      },
      refineLawBand: refine,
      async buildComplianceChecklist(input, riskBand) {
        return new Zone2LawServiceStub().buildComplianceChecklist(input, riskBand);
      },
      async finalizeEngagementPack(input, checklistId, riskBand) {
        return new Zone2LawServiceStub().finalizeEngagementPack(input, checklistId, riskBand);
      },
    };
    const band = new LawEnginePhase3Band(zone2);
    await band.analyze({
      employeeName: "Eve",
      companyName: "Acme",
      situationType: "T",
      yearsOfService: 1,
    });
    const arg0 = refine.mock.calls[0]![0]!;
    expect(arg0.employeeToken).toMatch(/^\[EMPLOYEE_/);
    expect(JSON.stringify(arg0)).not.toContain("Eve");
  });

  it("throws when Zone2 risk band mismatches fused thresholds", async () => {
    const bad: Zone2LawService = {
      async analyzeLaw(input) {
        return new Zone2LawServiceStub().analyzeLaw(input);
      },
      async refineLawBand() {
        return {
          refinementId: "x",
          riskBand: "LOW",
          summary: "wrong",
        };
      },
      async buildComplianceChecklist(input, riskBand) {
        return new Zone2LawServiceStub().buildComplianceChecklist(input, riskBand);
      },
      async finalizeEngagementPack(input, checklistId, riskBand) {
        return new Zone2LawServiceStub().finalizeEngagementPack(input, checklistId, riskBand);
      },
    };
    const band = new LawEnginePhase3Band(bad);
    await expect(
      band.analyze({
        employeeName: "A",
        companyName: "B",
        situationType: "S",
        yearsOfService: 20,
      }),
    ).rejects.toThrow(/riskBand must match/);
  });
});

describe("Sprint 23 — fused score drives HIGH path", () => {
  beforeEach(() => {
    resetLawCaseAnonymizerCounters();
  });

  it("long tenure yields HIGH risk band with default stub confidence", async () => {
    const band = new LawEnginePhase3Band(new Zone2LawServiceStub());
    const out = await band.analyze({
      employeeName: "X",
      companyName: "Y",
      situationType: "S",
      yearsOfService: 40,
    });
    expect(out.riskBand).toBe(riskBandFromFusedScore(out.fusedScore));
    expect(out.riskBand).toBe("HIGH");
  });
});

describe("Sprint 23 — lawEnginePhase3Band default export", () => {
  beforeEach(() => {
    resetLawCaseAnonymizerCounters();
  });

  it("runs via index default", async () => {
    const { lawEnginePhase3Band } = await import("../coherentSystem/index.js");
    const out = await lawEnginePhase3Band.analyze({
      employeeName: "P",
      companyName: "Q",
      situationType: "WHISTLEBLOW",
      yearsOfService: 0,
    });
    expect(out.recommendation).toBe("ESCALATE_TO_SOLICITOR");
    expect(out.riskBand).toBe(riskBandFromFusedScore(out.fusedScore));
    expect(out.riskBand).toBe("MEDIUM");
  });
});

describe("Sprint 23 — stub buildComplianceChecklist (for Phase 4)", () => {
  it("LOW yields two items", async () => {
    const stub = new Zone2LawServiceStub();
    const cl = await stub.buildComplianceChecklist(
      {
        employeeToken: "[EMPLOYEE_1]",
        companyToken: "[COMPANY_1]",
        situationType: "S",
        yearsOfService: 1,
      },
      "LOW",
    );
    expect(cl.items).toHaveLength(2);
  });
  it("MEDIUM yields three items", async () => {
    const stub = new Zone2LawServiceStub();
    const cl = await stub.buildComplianceChecklist(
      {
        employeeToken: "[EMPLOYEE_1]",
        companyToken: "[COMPANY_1]",
        situationType: "S",
        yearsOfService: 1,
      },
      "MEDIUM",
    );
    expect(cl.items).toHaveLength(3);
  });
  it("HIGH yields four items", async () => {
    const stub = new Zone2LawServiceStub();
    const cl = await stub.buildComplianceChecklist(
      {
        employeeToken: "[EMPLOYEE_1]",
        companyToken: "[COMPANY_1]",
        situationType: "S",
        yearsOfService: 1,
      },
      "HIGH",
    );
    expect(cl.items).toHaveLength(4);
  });
  it("deterministic checklistId", async () => {
    const stub = new Zone2LawServiceStub();
    const input: AnonymizedLawCaseInput = {
      employeeToken: "[EMPLOYEE_1]",
      companyToken: "[COMPANY_1]",
      situationType: "S",
      yearsOfService: 1,
    };
    const a = await stub.buildComplianceChecklist(input, "MEDIUM");
    const b = await stub.buildComplianceChecklist(input, "MEDIUM");
    expect(a.checklistId).toBe(b.checklistId);
  });
  it("different riskBand changes checklistId", async () => {
    const stub = new Zone2LawServiceStub();
    const input: AnonymizedLawCaseInput = {
      employeeToken: "[EMPLOYEE_1]",
      companyToken: "[COMPANY_1]",
      situationType: "S",
      yearsOfService: 1,
    };
    const low = await stub.buildComplianceChecklist(input, "LOW");
    const high = await stub.buildComplianceChecklist(input, "HIGH");
    expect(low.checklistId).not.toBe(high.checklistId);
  });
});

describe("Sprint 23 — stub refine grid", () => {
  it.each(Array.from({ length: 12 }, (_, i) => i))("refine iteration %i", async (i) => {
    const stub = new Zone2LawServiceStub();
    const fused = i / 20;
    const r = await stub.refineLawBand(
      {
        employeeToken: `[E_${i}]`,
        companyToken: `[C_${i}]`,
        situationType: `ST_${i}`,
        yearsOfService: i,
      },
      fused,
    );
    expect(r.riskBand).toBe(riskBandFromFusedScore(fused));
    expect(r.refinementId).toMatch(/^[a-f0-9]{20}$/);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LawEnginePhase4Band } from "../coherentSystem/lawEnginePhase4.js";
import { resetLawCaseAnonymizerCounters } from "../coherentSystem/lawEnginePhase2.js";
import { Zone2LawServiceStub } from "../coherentSystem/zone2LawStub.js";
import type { AnonymizedLawCaseInput, RawLawCasePayload, Zone2LawService } from "../coherentSystem/zone2LawTypes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql120 = readFileSync(join(__dirname, "../../db/migrations/120_sprint24_law_engine_phase4.sql"), "utf8");

describe("migration 120_sprint24_law_engine_phase4.sql", () => {
  it("creates law_engine_phase4_checklist_audit", () => {
    expect(sql120).toMatch(/CREATE TABLE IF NOT EXISTS public\.law_engine_phase4_checklist_audit/i);
  });
  it("stores zone2_stub_checklist", () => {
    expect(sql120).toMatch(/zone2_stub_checklist/i);
  });
  it("risk_band CHECK", () => {
    expect(sql120).toMatch(/CHECK \(risk_band IN \('LOW', 'MEDIUM', 'HIGH'\)\)/i);
  });
  it("situation_fingerprint column", () => {
    expect(sql120).toMatch(/situation_fingerprint/i);
  });
  it("RLS self select and insert", () => {
    expect(sql120).toMatch(/law_engine_phase4_checklist_self_select/i);
    expect(sql120).toMatch(/law_engine_phase4_checklist_self_insert/i);
  });
  it("admin delete policy", () => {
    expect(sql120).toMatch(/law_engine_phase4_checklist_admin_delete/i);
  });
  it("down migration drops table", () => {
    const down = readFileSync(join(__dirname, "../../db/migrations/120_sprint24_law_engine_phase4.down.sql"), "utf8");
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.law_engine_phase4_checklist_audit/i);
  });
});

describe("Sprint 24 — LawEnginePhase4Band", () => {
  beforeEach(() => {
    resetLawCaseAnonymizerCounters();
  });

  it("returns checklist fields with expected lengths for MEDIUM fused path", async () => {
    const band = new LawEnginePhase4Band(new Zone2LawServiceStub());
    const raw: RawLawCasePayload = {
      employeeName: "Alex",
      companyName: "Contoso",
      situationType: "GRIEVANCE",
      yearsOfService: 0,
    };
    const out = await band.analyze(raw);
    expect(out.checklistId).toMatch(/^[a-f0-9]{20}$/);
    expect(out.riskBand).toBe("MEDIUM");
    expect(out.checklistItems.length).toBe(3);
    expect(out.refinementId.length).toBeGreaterThan(0);
  });

  it("HIGH risk yields four checklist items", async () => {
    const band = new LawEnginePhase4Band(new Zone2LawServiceStub());
    const out = await band.analyze({
      employeeName: "A",
      companyName: "B",
      situationType: "S",
      yearsOfService: 40,
    });
    expect(out.riskBand).toBe("HIGH");
    expect(out.checklistItems).toHaveLength(4);
  });

  it("same raw input yields same checklistId across repeated analyzes", async () => {
    const band = new LawEnginePhase4Band(new Zone2LawServiceStub());
    const raw: RawLawCasePayload = {
      employeeName: "Pat",
      companyName: "Co",
      situationType: "TRIBUNAL_PREP",
      yearsOfService: 15,
    };
    const a = await band.analyze(raw);
    resetLawCaseAnonymizerCounters();
    const b = await band.analyze(raw);
    expect(a.checklistId).toBe(b.checklistId);
    expect(a.riskBand).toBe(b.riskBand);
  });

  it("buildComplianceChecklist receives tokenized payload (spy)", async () => {
    const checklist = vi.fn(async (input: AnonymizedLawCaseInput, riskBand: "LOW" | "MEDIUM" | "HIGH") => {
      return new Zone2LawServiceStub().buildComplianceChecklist(input, riskBand);
    });
    const zone2: Zone2LawService = {
      async analyzeLaw(input) {
        return new Zone2LawServiceStub().analyzeLaw(input);
      },
      async refineLawBand(input, fused) {
        return new Zone2LawServiceStub().refineLawBand(input, fused);
      },
      buildComplianceChecklist: checklist,
      async finalizeEngagementPack(input, checklistId, riskBand) {
        return new Zone2LawServiceStub().finalizeEngagementPack(input, checklistId, riskBand);
      },
    };
    const band = new LawEnginePhase4Band(zone2);
    await band.analyze({
      employeeName: "SecretUser",
      companyName: "SecretOrg",
      situationType: "X",
      yearsOfService: 5,
    });
    const arg = checklist.mock.calls[0]![0]!;
    expect(JSON.stringify(arg)).not.toContain("SecretUser");
    expect(arg.employeeToken).toMatch(/^\[EMPLOYEE_/);
  });
});

describe("Sprint 24 — lawEnginePhase4Band default export", () => {
  beforeEach(() => {
    resetLawCaseAnonymizerCounters();
  });

  it("runs via index default", async () => {
    const { lawEnginePhase4Band } = await import("../coherentSystem/index.js");
    const out = await lawEnginePhase4Band.analyze({
      employeeName: "U",
      companyName: "V",
      situationType: "DISCIPLINARY",
      yearsOfService: 2,
    });
    expect(out.checklistItems.length).toBeGreaterThanOrEqual(2);
    expect(out.recommendation).toBe("ESCALATE_TO_SOLICITOR");
  });
});

describe("Sprint 24 — checklist item count by risk band (stub)", () => {
  it.each([
    ["LOW", 2],
    ["MEDIUM", 3],
    ["HIGH", 4],
  ] as const)("band %s -> %i items", async (band, n) => {
    const stub = new Zone2LawServiceStub();
    const cl = await stub.buildComplianceChecklist(
      {
        employeeToken: "[EMPLOYEE_1]",
        companyToken: "[COMPANY_1]",
        situationType: "S",
        yearsOfService: 1,
      },
      band,
    );
    expect(cl.items).toHaveLength(n);
  });
});

describe("Sprint 24 — checklist determinism grid", () => {
  it.each(Array.from({ length: 24 }, (_, i) => i))("checklist row %i", async (i) => {
    const stub = new Zone2LawServiceStub();
    const input: AnonymizedLawCaseInput = {
      employeeToken: `[E${i}]`,
      companyToken: `[C${i}]`,
      situationType: `ST${i}`,
      yearsOfService: i % 5,
    };
    const band: "LOW" | "MEDIUM" | "HIGH" = i % 3 === 0 ? "LOW" : i % 3 === 1 ? "MEDIUM" : "HIGH";
    const a = await stub.buildComplianceChecklist(input, band);
    const b = await stub.buildComplianceChecklist(input, band);
    expect(a.checklistId).toBe(b.checklistId);
    expect(a.items.length).toBe(b.items.length);
  });
});

describe("Sprint 24 — phase4 preserves phase3 user labels", () => {
  beforeEach(() => {
    resetLawCaseAnonymizerCounters();
  });

  it("employerLabel from de-anonymization", async () => {
    const band = new LawEnginePhase4Band(new Zone2LawServiceStub());
    const out = await band.analyze({
      employeeName: "Chris",
      companyName: "Initech",
      situationType: "S",
      yearsOfService: 1,
    });
    expect(out.employerLabel).toBe("Initech");
    expect(out.relatedTo).toBe("You");
  });
});

describe("Sprint 24 — UserFacingLawPhase4Result keys", () => {
  beforeEach(() => {
    resetLawCaseAnonymizerCounters();
  });

  it("includes analysisId", async () => {
    const band = new LawEnginePhase4Band(new Zone2LawServiceStub());
    const out = await band.analyze({
      employeeName: "a",
      companyName: "b",
      situationType: "S",
      yearsOfService: 0,
    });
    expect(out.analysisId.length).toBeGreaterThan(0);
  });
  it("includes refinementSummary", async () => {
    const band = new LawEnginePhase4Band(new Zone2LawServiceStub());
    const out = await band.analyze({
      employeeName: "a",
      companyName: "b",
      situationType: "TYPE_A",
      yearsOfService: 0,
    });
    expect(out.refinementSummary).toContain("TYPE_A");
  });
  it("includes checklistItems array", async () => {
    const band = new LawEnginePhase4Band(new Zone2LawServiceStub());
    const out = await band.analyze({
      employeeName: "a",
      companyName: "b",
      situationType: "S",
      yearsOfService: 0,
    });
    expect(Array.isArray(out.checklistItems)).toBe(true);
  });
});

describe("Sprint 24 — fused score on phase4 output", () => {
  beforeEach(() => {
    resetLawCaseAnonymizerCounters();
  });

  it("fusedScore bounded", async () => {
    const band = new LawEnginePhase4Band(new Zone2LawServiceStub());
    const out = await band.analyze({
      employeeName: "a",
      companyName: "b",
      situationType: "S",
      yearsOfService: 10,
    });
    expect(out.fusedScore).toBeGreaterThanOrEqual(0);
    expect(out.fusedScore).toBeLessThanOrEqual(1);
  });
});

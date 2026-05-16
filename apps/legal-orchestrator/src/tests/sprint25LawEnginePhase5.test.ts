import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LawEnginePhase5Band,
  readinessFromRiskBand,
} from "../coherentSystem/lawEnginePhase5.js";
import { LawEnginePhase4Band } from "../coherentSystem/lawEnginePhase4.js";
import { resetLawCaseAnonymizerCounters } from "../coherentSystem/lawEnginePhase2.js";
import { Zone2LawServiceStub } from "../coherentSystem/zone2LawStub.js";
import type { AnonymizedLawCaseInput, RawLawCasePayload, Zone2LawService } from "../coherentSystem/zone2LawTypes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql121 = readFileSync(join(__dirname, "../../db/migrations/121_sprint25_law_engine_phase5.sql"), "utf8");

describe("migration 121_sprint25_law_engine_phase5.sql", () => {
  it("creates law_engine_phase5_finalization_audit", () => {
    expect(sql121).toMatch(/CREATE TABLE IF NOT EXISTS public\.law_engine_phase5_finalization_audit/i);
  });
  it("checklist_id column", () => {
    expect(sql121).toMatch(/checklist_id/i);
  });
  it("zone2_stub_finalization column", () => {
    expect(sql121).toMatch(/zone2_stub_finalization/i);
  });
  it("risk_band CHECK", () => {
    expect(sql121).toMatch(/CHECK \(risk_band IN \('LOW', 'MEDIUM', 'HIGH'\)\)/i);
  });
  it("RLS policies", () => {
    expect(sql121).toMatch(/law_engine_phase5_final_self_select/i);
    expect(sql121).toMatch(/law_engine_phase5_final_self_insert/i);
    expect(sql121).toMatch(/law_engine_phase5_final_admin_delete/i);
  });
  it("down migration drops table", () => {
    const down = readFileSync(join(__dirname, "../../db/migrations/121_sprint25_law_engine_phase5.down.sql"), "utf8");
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.law_engine_phase5_finalization_audit/i);
  });
});

describe("Sprint 25 — readinessFromRiskBand", () => {
  it("LOW -> DRAFT", () => {
    expect(readinessFromRiskBand("LOW")).toBe("DRAFT");
  });
  it("MEDIUM -> REVIEW", () => {
    expect(readinessFromRiskBand("MEDIUM")).toBe("REVIEW");
  });
  it("HIGH -> COURT_READY", () => {
    expect(readinessFromRiskBand("HIGH")).toBe("COURT_READY");
  });
});

describe("Sprint 25 — Zone2LawServiceStub finalizeEngagementPack", () => {
  it("deterministic packId", async () => {
    const stub = new Zone2LawServiceStub();
    const input: AnonymizedLawCaseInput = {
      employeeToken: "[EMPLOYEE_1]",
      companyToken: "[COMPANY_1]",
      situationType: "S",
      yearsOfService: 2,
    };
    const a = await stub.finalizeEngagementPack(input, "abc123", "MEDIUM");
    const b = await stub.finalizeEngagementPack(input, "abc123", "MEDIUM");
    expect(a.packId).toBe(b.packId);
    expect(a.readinessLevel).toBe("REVIEW");
  });

  it("digest is 16 hex chars", async () => {
    const stub = new Zone2LawServiceStub();
    const r = await stub.finalizeEngagementPack(
      {
        employeeToken: "[E]",
        companyToken: "[C]",
        situationType: "X",
        yearsOfService: 0,
      },
      "cid",
      "LOW",
    );
    expect(r.digest).toMatch(/^[a-f0-9]{16}$/);
  });
});

describe("Sprint 25 — LawEnginePhase5Band", () => {
  beforeEach(() => {
    resetLawCaseAnonymizerCounters();
  });

  it("returns pack fields for HIGH path", async () => {
    const band = new LawEnginePhase5Band(new Zone2LawServiceStub());
    const out = await band.analyze({
      employeeName: "Ann",
      companyName: "Corp",
      situationType: "DISMISSAL",
      yearsOfService: 40,
    });
    expect(out.readinessLevel).toBe("COURT_READY");
    expect(out.packId.length).toBe(24);
    expect(out.packDigest).toMatch(/^[a-f0-9]{16}$/);
    expect(out.checklistItems.length).toBe(4);
  });

  it("MEDIUM path yields REVIEW", async () => {
    const band = new LawEnginePhase5Band(new Zone2LawServiceStub());
    const out = await band.analyze({
      employeeName: "B",
      companyName: "C",
      situationType: "GRIEVANCE",
      yearsOfService: 0,
    });
    expect(out.riskBand).toBe("MEDIUM");
    expect(out.readinessLevel).toBe("REVIEW");
  });

  it("finalizeEngagementPack receives tokenized input", async () => {
    const fin = vi.fn(async (input: AnonymizedLawCaseInput, checklistId: string, riskBand: "LOW" | "MEDIUM" | "HIGH") => {
      return new Zone2LawServiceStub().finalizeEngagementPack(input, checklistId, riskBand);
    });
    const zone2: Zone2LawService = {
      async analyzeLaw(input) {
        return new Zone2LawServiceStub().analyzeLaw(input);
      },
      async refineLawBand(input, fused) {
        return new Zone2LawServiceStub().refineLawBand(input, fused);
      },
      async buildComplianceChecklist(input, riskBand) {
        return new Zone2LawServiceStub().buildComplianceChecklist(input, riskBand);
      },
      finalizeEngagementPack: fin,
    };
    const band = new LawEnginePhase5Band(zone2);
    await band.analyze({
      employeeName: "SecretPerson",
      companyName: "SecretCo",
      situationType: "S",
      yearsOfService: 1,
    });
    const arg = fin.mock.calls[0]![0]!;
    expect(JSON.stringify(arg)).not.toContain("SecretPerson");
  });

  it("throws when finalize readiness mismatches risk band", async () => {
    const zone2: Zone2LawService = {
      async analyzeLaw(input) {
        return new Zone2LawServiceStub().analyzeLaw(input);
      },
      async refineLawBand(input, fused) {
        return new Zone2LawServiceStub().refineLawBand(input, fused);
      },
      async buildComplianceChecklist(input, riskBand) {
        return new Zone2LawServiceStub().buildComplianceChecklist(input, riskBand);
      },
      async finalizeEngagementPack() {
        return {
          packId: "x".repeat(24),
          readinessLevel: "DRAFT",
          digest: "0".repeat(16),
        };
      },
    };
    const band = new LawEnginePhase5Band(zone2);
    await expect(
      band.analyze({
        employeeName: "A",
        companyName: "B",
        situationType: "S",
        yearsOfService: 40,
      }),
    ).rejects.toThrow(/readinessLevel must match/);
  });
});

describe("Sprint 25 — LawEnginePhase4Band analyzeWithMeta", () => {
  beforeEach(() => {
    resetLawCaseAnonymizerCounters();
  });

  it("returns user and anonymized", async () => {
    const band = new LawEnginePhase4Band(new Zone2LawServiceStub());
    const { user, anonymized } = await band.analyzeWithMeta({
      employeeName: "Z",
      companyName: "Y",
      situationType: "S",
      yearsOfService: 1,
    });
    expect(user.checklistId.length).toBeGreaterThan(0);
    expect(anonymized.employeeToken).toMatch(/^\[EMPLOYEE_/);
  });
});

describe("Sprint 25 — lawEnginePhase5Band default export", () => {
  beforeEach(() => {
    resetLawCaseAnonymizerCounters();
  });

  it("runs via index", async () => {
    const { lawEnginePhase5Band } = await import("../coherentSystem/index.js");
    const out = await lawEnginePhase5Band.analyze({
      employeeName: "U",
      companyName: "V",
      situationType: "DISCIPLINARY",
      yearsOfService: 2,
    });
    expect(out.packId.length).toBe(24);
    expect(out.recommendation).toBe("ESCALATE_TO_SOLICITOR");
  });
});

describe("Sprint 25 — stub finalize grid", () => {
  it.each(Array.from({ length: 20 }, (_, i) => i))("finalize row %i", async (i) => {
    const stub = new Zone2LawServiceStub();
    const input: AnonymizedLawCaseInput = {
      employeeToken: `[E${i}]`,
      companyToken: `[C${i}]`,
      situationType: `T${i}`,
      yearsOfService: i % 7,
    };
    const band: "LOW" | "MEDIUM" | "HIGH" = i % 3 === 0 ? "LOW" : i % 3 === 1 ? "MEDIUM" : "HIGH";
    const a = await stub.finalizeEngagementPack(input, `cl-${i}`, band);
    const b = await stub.finalizeEngagementPack(input, `cl-${i}`, band);
    expect(a.packId).toBe(b.packId);
    expect(a.readinessLevel).toBe(readinessFromRiskBand(band));
  });
});

describe("Sprint 25 — repeat analyze deterministic pack", () => {
  beforeEach(() => {
    resetLawCaseAnonymizerCounters();
  });

  it("same raw twice after counter reset yields same packId", async () => {
    const band = new LawEnginePhase5Band(new Zone2LawServiceStub());
    const raw: RawLawCasePayload = {
      employeeName: "M",
      companyName: "N",
      situationType: "REDUNDANCY",
      yearsOfService: 12,
    };
    const first = await band.analyze(raw);
    resetLawCaseAnonymizerCounters();
    const second = await band.analyze(raw);
    expect(first.packId).toBe(second.packId);
  });
});

describe("Sprint 25 — readiness alignment table", () => {
  it.each([
    ["LOW", "DRAFT"],
    ["MEDIUM", "REVIEW"],
    ["HIGH", "COURT_READY"],
  ] as const)("risk %s -> %s", async (risk, readiness) => {
    const stub = new Zone2LawServiceStub();
    const r = await stub.finalizeEngagementPack(
      {
        employeeToken: "[EMPLOYEE_1]",
        companyToken: "[COMPANY_1]",
        situationType: "S",
        yearsOfService: 1,
      },
      "checklist-x",
      risk,
    );
    expect(r.readinessLevel).toBe(readiness);
  });
});

describe("Sprint 25 — de-anonymized labels preserved", () => {
  beforeEach(() => {
    resetLawCaseAnonymizerCounters();
  });

  it("employerLabel survives pipeline", async () => {
    const band = new LawEnginePhase5Band(new Zone2LawServiceStub());
    const out = await band.analyze({
      employeeName: "Lee",
      companyName: "Initech",
      situationType: "S",
      yearsOfService: 3,
    });
    expect(out.employerLabel).toBe("Initech");
    expect(out.relatedTo).toBe("You");
  });
});

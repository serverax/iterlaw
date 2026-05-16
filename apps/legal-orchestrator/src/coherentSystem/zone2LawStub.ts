import { createHash } from "node:crypto";
import type {
  AnonymizedLawCaseInput,
  LawAnalysisResult,
  LawChecklistItem,
  LawChecklistResult,
  LawFinalizationResult,
  LawReadinessLevel,
  LawRefinementResult,
  LawRiskBand,
  Zone2LawService,
} from "./zone2LawTypes.js";

function stableAnalysisId(input: AnonymizedLawCaseInput): string {
  const canonical = JSON.stringify([
    input.employeeToken,
    input.companyToken,
    input.situationType,
    input.yearsOfService,
  ]);
  return createHash("sha256").update(canonical, "utf8").digest("hex").slice(0, 24);
}

/** Must match `riskBandFromFusedScore` in lawEnginePhase3.ts (Zone 1 thresholds). */
function stubRiskFromFused(fusedScore: number): LawRiskBand {
  const x = Math.min(1, Math.max(0, fusedScore));
  if (x < 0.35) return "LOW";
  if (x < 0.65) return "MEDIUM";
  return "HIGH";
}

function stableRefinementId(input: AnonymizedLawCaseInput, fusedScore: number): string {
  const canonical = JSON.stringify([
    input.employeeToken,
    input.companyToken,
    input.situationType,
    input.yearsOfService,
    fusedScore,
  ]);
  return createHash("sha256").update(canonical, "utf8").digest("hex").slice(0, 20);
}

function stableChecklistId(input: AnonymizedLawCaseInput, riskBand: LawRiskBand): string {
  const canonical = JSON.stringify([
    input.employeeToken,
    input.companyToken,
    input.situationType,
    input.yearsOfService,
    riskBand,
  ]);
  return createHash("sha256").update(canonical, "utf8").digest("hex").slice(0, 20);
}

/** Must match `readinessFromRiskBand` in lawEnginePhase5.ts. */
function readinessFromRiskStub(riskBand: LawRiskBand): LawReadinessLevel {
  if (riskBand === "LOW") return "DRAFT";
  if (riskBand === "MEDIUM") return "REVIEW";
  return "COURT_READY";
}

function stablePackId(input: AnonymizedLawCaseInput, checklistId: string, riskBand: LawRiskBand): string {
  const canonical = JSON.stringify([
    input.employeeToken,
    input.companyToken,
    input.situationType,
    input.yearsOfService,
    checklistId,
    riskBand,
  ]);
  return createHash("sha256").update(canonical, "utf8").digest("hex").slice(0, 24);
}

/**
 * Deterministic Zone 2 stub — same anonymized input yields same analysisId and confidence.
 * No network I/O.
 */
export class Zone2LawServiceStub implements Zone2LawService {
  async analyzeLaw(input: AnonymizedLawCaseInput): Promise<LawAnalysisResult> {
    return {
      analysisId: stableAnalysisId(input),
      confidence: 0.87,
      citations: [
        { statute: "ERA 1996 s.98", caselaw: undefined },
        { statute: undefined, caselaw: "Polkey v A.E. Dayton Services Ltd" },
      ],
      recommendation: "ESCALATE_TO_SOLICITOR",
    };
  }

  async refineLawBand(input: AnonymizedLawCaseInput, fusedScore: number): Promise<LawRefinementResult> {
    const riskBand = stubRiskFromFused(fusedScore);
    return {
      refinementId: stableRefinementId(input, fusedScore),
      riskBand,
      summary: `Refinement[${riskBand}] for ${input.situationType} (token lanes only).`,
    };
  }

  async buildComplianceChecklist(
    input: AnonymizedLawCaseInput,
    riskBand: LawRiskBand,
  ): Promise<LawChecklistResult> {
    const n = riskBand === "LOW" ? 2 : riskBand === "MEDIUM" ? 3 : 4;
    const items: LawChecklistItem[] = [];
    for (let i = 0; i < n; i++) {
      items.push({ id: `chk-${riskBand}-${i}`, label: `UK_EMP_CHECKLIST_${riskBand}_${i}` });
    }
    return { checklistId: stableChecklistId(input, riskBand), items };
  }

  async finalizeEngagementPack(
    input: AnonymizedLawCaseInput,
    checklistId: string,
    riskBand: LawRiskBand,
  ): Promise<LawFinalizationResult> {
    const readinessLevel = readinessFromRiskStub(riskBand);
    const packId = stablePackId(input, checklistId, riskBand);
    const digest = createHash("sha256")
      .update(`${packId}|${readinessLevel}`, "utf8")
      .digest("hex")
      .slice(0, 16);
    return { packId, readinessLevel, digest };
  }
}

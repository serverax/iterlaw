import { createHash } from "node:crypto";
import { fuseCalculatorScores } from "./lawEngineBand.js";
import type {
  AnonymizeLawCaseResult,
  AnonymizedLawCaseInput,
  LawAnalysisResult,
  RawLawCasePayload,
  UserFacingLawResult,
  Zone2LawService,
} from "./zone2LawTypes.js";

let employeeCounter = 0;
let companyCounter = 0;

function nextEmployeeToken(): string {
  employeeCounter += 1;
  return `[EMPLOYEE_${employeeCounter}]`;
}

function nextCompanyToken(): string {
  companyCounter += 1;
  return `[COMPANY_${companyCounter}]`;
}

/** Reset token counters between deterministic tests (same process). */
export function resetLawCaseAnonymizerCounters(): void {
  employeeCounter = 0;
  companyCounter = 0;
}

/**
 * Zone 1 — strip PII before any Zone 2 call. Only tokens cross the boundary.
 */
export function anonymizeLawCaseInput(raw: RawLawCasePayload): AnonymizeLawCaseResult {
  const tokenMap = new Map<string, string>();
  const empTok = raw.employeeName.trim() ? nextEmployeeToken() : "[EMPLOYEE_0]";
  const compTok = raw.companyName.trim() ? nextCompanyToken() : "[COMPANY_0]";
  if (raw.employeeName.trim()) {
    tokenMap.set(empTok, raw.employeeName.trim());
  }
  if (raw.companyName.trim()) {
    tokenMap.set(compTok, raw.companyName.trim());
  }
  const anonymized: AnonymizedLawCaseInput = {
    employeeToken: empTok,
    companyToken: compTok,
    situationType: raw.situationType,
    yearsOfService: raw.yearsOfService,
  };
  return { anonymized, tokenMap };
}

export function situationFingerprint(raw: RawLawCasePayload): string {
  return createHash("sha256")
    .update(`${raw.situationType}|${raw.yearsOfService}`, "utf8")
    .digest("hex")
    .slice(0, 32);
}

/** Zone 1 heuristic score (0–1) from tenure — deterministic, no Zone 2. */
export function calculateZone1LegalPositionScore(raw: RawLawCasePayload): number {
  const y = Math.min(40, Math.max(0, raw.yearsOfService));
  return Math.min(1, y / 40);
}

/** Fuse Zone 1 lane with Zone 2 confidence (weights favour Zone 2 slightly). */
export function fuseLawEngineResults(zone1Score: number, zone2: LawAnalysisResult): number {
  return fuseCalculatorScores([zone1Score, zone2.confidence], [0.45, 0.55]);
}

export function deAnonymizeLawResult(
  zone2: LawAnalysisResult,
  tokenMap: ReadonlyMap<string, string>,
  fusedScore: number,
): UserFacingLawResult {
  let relatedTo = "The employee";
  let employerLabel = "Your employer";
  for (const [tok, label] of tokenMap) {
    if (tok.startsWith("[EMPLOYEE_") && tok !== "[EMPLOYEE_0]") {
      relatedTo = "You";
    }
    if (tok.startsWith("[COMPANY_") && tok !== "[COMPANY_0]") {
      employerLabel = label;
    }
  }
  return {
    analysisId: zone2.analysisId,
    confidence: zone2.confidence,
    citations: zone2.citations,
    recommendation: zone2.recommendation,
    fusedScore,
    relatedTo,
    employerLabel,
  };
}

/**
 * Phase 2 orchestrator: Zone 1 scoring + anonymize → Zone 2 (stub) → fuse → de-anonymize.
 */
export class LawEnginePhase2Band {
  constructor(private readonly zone2: Zone2LawService) {}

  async analyze(raw: RawLawCasePayload): Promise<UserFacingLawResult> {
    const zone1 = calculateZone1LegalPositionScore(raw);
    const { anonymized, tokenMap } = anonymizeLawCaseInput(raw);
    const z2 = await this.zone2.analyzeLaw(anonymized);
    const fused = fuseLawEngineResults(zone1, z2);
    return deAnonymizeLawResult(z2, tokenMap, fused);
  }
}

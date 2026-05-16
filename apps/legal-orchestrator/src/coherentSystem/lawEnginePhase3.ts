import {
  anonymizeLawCaseInput,
  calculateZone1LegalPositionScore,
  deAnonymizeLawResult,
  fuseLawEngineResults,
} from "./lawEnginePhase2.js";
import type {
  AnonymizedLawCaseInput,
  LawRiskBand,
  RawLawCasePayload,
  UserFacingLawPhase3Result,
  UserFacingLawResult,
  Zone2LawService,
} from "./zone2LawTypes.js";

/** Deterministic risk band from fused Zone1+Zone2 score (0–1). */
export function riskBandFromFusedScore(fused: number): LawRiskBand {
  const x = Math.min(1, Math.max(0, fused));
  if (x < 0.35) return "LOW";
  if (x < 0.65) return "MEDIUM";
  return "HIGH";
}

function mergePhase3(
  base: UserFacingLawResult,
  refinement: { refinementId: string; riskBand: LawRiskBand; summary: string },
): UserFacingLawPhase3Result {
  return {
    ...base,
    riskBand: refinement.riskBand,
    refinementId: refinement.refinementId,
    refinementSummary: refinement.summary,
  };
}

/**
 * Phase 3: Phase 2 pipeline plus Zone 2 refinement (stub) on anonymized payload.
 */
export class LawEnginePhase3Band {
  constructor(private readonly zone2: Zone2LawService) {}

  /**
   * Single anonymization pass; exposes anonymized payload for Phase 4 checklist.
   */
  async analyzeWithMeta(raw: RawLawCasePayload): Promise<{
    user: UserFacingLawPhase3Result;
    anonymized: AnonymizedLawCaseInput;
    tokenMap: ReadonlyMap<string, string>;
  }> {
    const zone1 = calculateZone1LegalPositionScore(raw);
    const { anonymized, tokenMap } = anonymizeLawCaseInput(raw);
    const z2 = await this.zone2.analyzeLaw(anonymized);
    const fused = fuseLawEngineResults(zone1, z2);
    const base = deAnonymizeLawResult(z2, tokenMap, fused);
    const refinement = await this.zone2.refineLawBand(anonymized, fused);
    const band = riskBandFromFusedScore(fused);
    if (refinement.riskBand !== band) {
      throw new Error("Zone2LawService.refineLawBand riskBand must match Zone 1 fused thresholds");
    }
    return { user: mergePhase3(base, refinement), anonymized, tokenMap };
  }

  async analyze(raw: RawLawCasePayload): Promise<UserFacingLawPhase3Result> {
    const { user } = await this.analyzeWithMeta(raw);
    return user;
  }
}

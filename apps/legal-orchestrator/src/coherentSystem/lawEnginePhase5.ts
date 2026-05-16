import { LawEnginePhase4Band } from "./lawEnginePhase4.js";
import type {
  LawReadinessLevel,
  LawRiskBand,
  RawLawCasePayload,
  UserFacingLawPhase5Result,
  Zone2LawService,
} from "./zone2LawTypes.js";

/** Zone 1 mapping: risk band drives client-facing readiness label. */
export function readinessFromRiskBand(band: LawRiskBand): LawReadinessLevel {
  if (band === "LOW") return "DRAFT";
  if (band === "MEDIUM") return "REVIEW";
  return "COURT_READY";
}

/**
 * Phase 5: Phase 4 bundle plus Zone 2 engagement-pack finalization (stub).
 */
export class LawEnginePhase5Band {
  constructor(private readonly zone2: Zone2LawService) {}

  async analyze(raw: RawLawCasePayload): Promise<UserFacingLawPhase5Result> {
    const p4 = new LawEnginePhase4Band(this.zone2);
    const { user: u4, anonymized } = await p4.analyzeWithMeta(raw);
    const fin = await this.zone2.finalizeEngagementPack(anonymized, u4.checklistId, u4.riskBand);
    const expected = readinessFromRiskBand(u4.riskBand);
    if (fin.readinessLevel !== expected) {
      throw new Error(
        "Zone2LawService.finalizeEngagementPack readinessLevel must match Zone 1 risk band mapping",
      );
    }
    return {
      ...u4,
      packId: fin.packId,
      readinessLevel: fin.readinessLevel,
      packDigest: fin.digest,
    };
  }
}

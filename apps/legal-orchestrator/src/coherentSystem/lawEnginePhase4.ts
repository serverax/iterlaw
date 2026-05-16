import { LawEnginePhase3Band } from "./lawEnginePhase3.js";
import type { RawLawCasePayload, UserFacingLawPhase4Result, Zone2LawService } from "./zone2LawTypes.js";

/**
 * Phase 4: Phase 3 user result plus Zone 2 compliance checklist (stub), single anonymization path.
 */
export class LawEnginePhase4Band {
  constructor(private readonly zone2: Zone2LawService) {}

  async analyze(raw: RawLawCasePayload): Promise<UserFacingLawPhase4Result> {
    const phase3 = new LawEnginePhase3Band(this.zone2);
    const { user, anonymized } = await phase3.analyzeWithMeta(raw);
    const checklist = await this.zone2.buildComplianceChecklist(anonymized, user.riskBand);
    return {
      ...user,
      checklistId: checklist.checklistId,
      checklistItems: checklist.items,
    };
  }
}

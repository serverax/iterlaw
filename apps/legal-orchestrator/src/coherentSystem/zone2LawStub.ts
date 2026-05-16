import { createHash } from "node:crypto";
import type { AnonymizedLawCaseInput, LawAnalysisResult, Zone2LawService } from "./zone2LawTypes.js";

function stableAnalysisId(input: AnonymizedLawCaseInput): string {
  const canonical = JSON.stringify([
    input.employeeToken,
    input.companyToken,
    input.situationType,
    input.yearsOfService,
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
}

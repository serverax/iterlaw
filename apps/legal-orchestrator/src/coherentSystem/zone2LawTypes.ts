/** Sprint 22 — Zone 2 law contract (stubbed until Zone 2 is deployed). */

export interface RawLawCasePayload {
  readonly employeeName: string;
  readonly companyName: string;
  readonly situationType: string;
  readonly yearsOfService: number;
}

export interface AnonymizedLawCaseInput {
  readonly employeeToken: string;
  readonly companyToken: string;
  readonly situationType: string;
  readonly yearsOfService: number;
}

export interface LawCitation {
  readonly statute?: string;
  readonly caselaw?: string;
}

export interface LawAnalysisResult {
  readonly analysisId: string;
  readonly confidence: number;
  readonly citations: readonly LawCitation[];
  readonly recommendation: string;
}

export interface UserFacingLawResult {
  readonly analysisId: string;
  readonly confidence: number;
  readonly citations: readonly LawCitation[];
  readonly recommendation: string;
  /** Fused Zone 1 heuristic + Zone 2 confidence (0–1). */
  readonly fusedScore: number;
  readonly relatedTo: string;
  readonly employerLabel: string;
}

export type LawRiskBand = "LOW" | "MEDIUM" | "HIGH";

export interface LawRefinementResult {
  readonly refinementId: string;
  readonly riskBand: LawRiskBand;
  /** Token-safe stub copy (no raw PII). */
  readonly summary: string;
}

export interface UserFacingLawPhase3Result extends UserFacingLawResult {
  readonly riskBand: LawRiskBand;
  readonly refinementId: string;
  readonly refinementSummary: string;
}

export interface LawChecklistItem {
  readonly id: string;
  readonly label: string;
}

export interface LawChecklistResult {
  readonly checklistId: string;
  readonly items: readonly LawChecklistItem[];
}

export interface UserFacingLawPhase4Result extends UserFacingLawPhase3Result {
  readonly checklistId: string;
  readonly checklistItems: readonly LawChecklistItem[];
}

export interface AnonymizeLawCaseResult {
  readonly anonymized: AnonymizedLawCaseInput;
  /** Token → short display label for user-facing copy (Zone 1 only). */
  readonly tokenMap: ReadonlyMap<string, string>;
}

export interface Zone2LawService {
  analyzeLaw(input: AnonymizedLawCaseInput): Promise<LawAnalysisResult>;
  refineLawBand(input: AnonymizedLawCaseInput, fusedScore: number): Promise<LawRefinementResult>;
  buildComplianceChecklist(input: AnonymizedLawCaseInput, riskBand: LawRiskBand): Promise<LawChecklistResult>;
}

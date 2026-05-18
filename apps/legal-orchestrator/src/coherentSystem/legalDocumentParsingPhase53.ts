export type DocumentType =
  | "dismissal_letter"
  | "disciplinary_notice"
  | "redundancy_notice"
  | "unknown";

export interface EmploymentLetterAnalysis {
  readonly documentType: DocumentType;
  readonly confidenceScore: number;
  readonly issuesIdentified: readonly string[];
}

/** Sprint 53 — Legal document parsing (PREP: pipeline wired post-UAT). */
export class LegalDocumentParsingPhase53Band {
  detectDocumentType(text: string): DocumentType {
    const t = text.toLowerCase();
    if (t.includes("redundancy")) {
      return "redundancy_notice";
    }
    if (t.includes("disciplinary")) {
      return "disciplinary_notice";
    }
    if (t.includes("dismissed") || t.includes("terminated")) {
      return "dismissal_letter";
    }
    return "unknown";
  }

  async parseEmploymentLetter(_documentId: string, text: string): Promise<EmploymentLetterAnalysis> {
    return {
      documentType: this.detectDocumentType(text),
      confidenceScore: 0.5,
      issuesIdentified: [],
    };
  }
}

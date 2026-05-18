export type DocumentPrimaryCategory = "employment" | "housing" | "consumer" | "unknown";
export type DocumentUrgency = "high" | "medium" | "low";

export interface DocumentClassification {
  readonly primaryCategory: DocumentPrimaryCategory;
  readonly subCategory: string;
  readonly legalRelevanceScore: number;
  readonly urgency: DocumentUrgency;
  readonly actionsRequired: readonly string[];
}

/** Sprint 54 — Classification + metadata (PREP: pipeline wired post-UAT). */
export class DocumentClassificationPhase54Band {
  classifyFromText(text: string): DocumentClassification {
    const t = text.toLowerCase();
    let primaryCategory: DocumentPrimaryCategory = "unknown";
    if (/employment|dismissal|disciplinary|redundancy/.test(t)) {
      primaryCategory = "employment";
    } else if (/tenancy|eviction|landlord/.test(t)) {
      primaryCategory = "housing";
    } else if (/refund|warranty|consumer/.test(t)) {
      primaryCategory = "consumer";
    }
    const urgency: DocumentUrgency = t.includes("deadline") || t.includes("within 7 days") ? "high" : "medium";
    return {
      primaryCategory,
      subCategory: primaryCategory === "unknown" ? "unclassified" : primaryCategory,
      legalRelevanceScore: primaryCategory === "unknown" ? 0.3 : 0.7,
      urgency,
      actionsRequired: urgency === "high" ? ["review_deadline"] : [],
    };
  }

  async classifyDocument(_documentId: string, text: string): Promise<DocumentClassification> {
    return this.classifyFromText(text);
  }
}

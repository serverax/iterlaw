export type EntityType = "person" | "date" | "amount" | "clause" | "reference";

export interface ExtractedEntity {
  readonly id: string;
  readonly documentId: string;
  readonly entityType: EntityType;
  readonly text: string;
  readonly confidenceScore: number;
  readonly pageNumber: number;
}

/** Sprint 52 — Entity extraction (PREP: pipeline wired post-UAT). */
export class EntityExtractionPhase52Band {
  classifyEntity(text: string, context: string): EntityType {
    const t = `${text} ${context}`.toLowerCase();
    if (/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(t)) {
      return "date";
    }
    if (/£|\$|eur|gbp|salary|pay/.test(t)) {
      return "amount";
    }
    if (/clause|section|policy|procedure/.test(t)) {
      return "clause";
    }
    if (/ref\.|reference|policy number/.test(t)) {
      return "reference";
    }
    return "person";
  }

  async extractEntities(_documentId: string): Promise<readonly ExtractedEntity[]> {
    return [];
  }
}

import type { Zone2DocumentService } from "./zone2DocumentTypes.js";

export interface Citation {
  readonly chunkId: string;
  readonly chunkText: string;
  readonly startChar: number;
  readonly endChar: number;
}

export interface CitedAnswer {
  readonly answerText: string;
  readonly lawSection: string;
  readonly meaning: string;
  readonly action: string;
  readonly citations: readonly Citation[];
  readonly confidenceScore: number;
}

/** Sprint 57 — Citation-locked answer synthesis. */
export class CitationLockedAnswerPhase57Band {
  constructor(private readonly zone2: Zone2DocumentService) {}

  buildCitations(chunkIds: readonly string[], chunkTexts: readonly string[]): readonly Citation[] {
    return chunkIds.map((chunkId, i) => {
      const chunkText = chunkTexts[i] ?? "";
      return { chunkId, chunkText, startChar: 0, endChar: chunkText.length };
    });
  }

  validateCitations(answer: CitedAnswer): { readonly valid: boolean; readonly unsupportedClaims: number } {
    const unsupportedClaims = answer.citations.length === 0 ? 1 : 0;
    return { valid: unsupportedClaims === 0, unsupportedClaims };
  }

  async generateAnswer(question: string, chunkTexts: readonly string[], chunkIds: readonly string[]): Promise<CitedAnswer> {
    const synthesis = await this.zone2.synthesizeCitedAnswer(question, chunkTexts);
    const citations = this.buildCitations(chunkIds, chunkTexts);
    return {
      answerText: synthesis.answerText,
      lawSection: synthesis.lawSection,
      meaning: synthesis.meaning,
      action: synthesis.action,
      citations,
      confidenceScore: synthesis.confidence,
    };
  }
}

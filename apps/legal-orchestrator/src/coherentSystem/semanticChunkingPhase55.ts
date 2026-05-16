import type { Zone2DocumentService } from "./zone2DocumentTypes.js";
import { chunkCoherenceScore } from "./documentIntelBand.js";

export interface DocumentChunkDraft {
  readonly chunkNumber: number;
  readonly chunkText: string;
  readonly semanticTopic: string;
  readonly legalSignificance: number;
}

export const SEMANTIC_CHUNK_MIN_TOKENS = 200;
export const SEMANTIC_CHUNK_MAX_TOKENS = 500;

/** Sprint 55 — Legal-aware semantic chunking (PREP: embeddings post-UAT). */
export class SemanticChunkingPhase55Band {
  constructor(private readonly zone2: Zone2DocumentService) {}

  estimateTokenCount(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
  }

  chunkDocumentText(text: string): readonly DocumentChunkDraft[] {
    const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    if (paragraphs.length === 0) {
      return [];
    }
    return paragraphs.map((chunkText, i) => ({
      chunkNumber: i,
      chunkText,
      semanticTopic: i === 0 ? "introduction" : "body",
      legalSignificance: /deadline|appeal|dismissal/i.test(chunkText) ? 0.9 : 0.4,
    }));
  }

  boundaryCoherence(a: string, b: string): number {
    return chunkCoherenceScore(a, b);
  }

  async generateEmbeddings(chunks: readonly DocumentChunkDraft[]): Promise<readonly number[][]> {
    const batch = await this.zone2.embedTexts(chunks.map((c) => c.chunkText));
    return batch.vectors.map((v) => [...v]);
  }
}

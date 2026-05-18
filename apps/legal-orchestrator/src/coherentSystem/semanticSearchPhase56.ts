export interface SearchResult {
  readonly chunkId: string;
  readonly documentId: string;
  readonly similarityScore: number;
  readonly chunkText: string;
  readonly semanticTopic: string;
}

export const SEMANTIC_SEARCH_MIN_SIMILARITY = 0.85;
export const SEMANTIC_SEARCH_DEFAULT_TOP_K = 5;

/** Sprint 56 — Vector search + RAG retrieval (PREP: pgvector queries post-UAT). */
export class SemanticSearchPhase56Band {
  rankResults(results: readonly SearchResult[], topK = SEMANTIC_SEARCH_DEFAULT_TOP_K): readonly SearchResult[] {
    return [...results]
      .filter((r) => r.similarityScore >= SEMANTIC_SEARCH_MIN_SIMILARITY)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, topK);
  }

  cosineSimilarity(a: readonly number[], b: readonly number[]): number {
    if (a.length === 0 || b.length === 0 || a.length !== b.length) {
      return 0;
    }
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i += 1) {
      dot += a[i]! * b[i]!;
      na += a[i]! * a[i]!;
      nb += b[i]! * b[i]!;
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
  }

  async searchDocuments(_query: string, _documentId?: string): Promise<readonly SearchResult[]> {
    return [];
  }
}

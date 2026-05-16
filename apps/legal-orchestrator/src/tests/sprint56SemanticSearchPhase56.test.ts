import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SemanticSearchPhase56Band, SEMANTIC_SEARCH_MIN_SIMILARITY } from "../coherentSystem/semanticSearchPhase56.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql152 = readFileSync(join(__dirname, "../../db/migrations/152_sprint56_search_sessions.sql"), "utf8");
const band = new SemanticSearchPhase56Band();

describe("migration 152 sprint 56", () => {
  it("search_sessions table", () => expect(sql152).toMatch(/CREATE TABLE IF NOT EXISTS public\.search_sessions/i));
  it("user_id fk", () => expect(sql152).toMatch(/user_id/i));
  it("results_returned", () => expect(sql152).toMatch(/results_returned/i));
  it("owner select policy", () => expect(sql152).toMatch(/search_sessions_owner_select/i));
});

describe("SemanticSearchPhase56Band", () => {
  it("cosine identical vectors", () => {
    expect(band.cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
  });
  it("filters by min similarity", () => {
    const ranked = band.rankResults([
      { chunkId: "a", documentId: "d", similarityScore: 0.9, chunkText: "t", semanticTopic: "x" },
      { chunkId: "b", documentId: "d", similarityScore: 0.5, chunkText: "t", semanticTopic: "x" },
    ]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.similarityScore).toBeGreaterThanOrEqual(SEMANTIC_SEARCH_MIN_SIMILARITY);
  });
});

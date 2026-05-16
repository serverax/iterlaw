import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SemanticChunkingPhase55Band, SEMANTIC_CHUNK_MAX_TOKENS, SEMANTIC_CHUNK_MIN_TOKENS } from "../coherentSystem/semanticChunkingPhase55.js";
import { Zone2DocumentServiceStub } from "../coherentSystem/zone2DocumentStub.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql151 = readFileSync(join(__dirname, "../../db/migrations/151_sprint55_document_chunks_semantic.sql"), "utf8");
const band = new SemanticChunkingPhase55Band(new Zone2DocumentServiceStub());

describe("migration 151 sprint 55", () => {
  it("vector extension", () => expect(sql151).toMatch(/CREATE EXTENSION IF NOT EXISTS vector/i));
  it("embedding_vector column", () => expect(sql151).toMatch(/embedding_vector vector\(1536\)/i));
  it("semantic_topic", () => expect(sql151).toMatch(/semantic_topic/i));
  it("legal_significance", () => expect(sql151).toMatch(/legal_significance/i));
  it("ivfflat index", () => expect(sql151).toMatch(/idx_document_chunks_sprint55_embedding/i));
});

describe("SemanticChunkingPhase55Band", () => {
  it("token bounds constants", () => {
    expect(SEMANTIC_CHUNK_MIN_TOKENS).toBe(200);
    expect(SEMANTIC_CHUNK_MAX_TOKENS).toBe(500);
  });
  it("chunks paragraphs", () => {
    const chunks = band.chunkDocumentText("Intro\n\nAppeal deadline Friday");
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.some((c) => c.legalSignificance >= 0.8)).toBe(true);
  });
  it("boundary coherence", () => {
    expect(band.boundaryCoherence("appeal rights", "appeal rights form")).toBeGreaterThan(0);
  });
  it("generateEmbeddings", async () => {
    const chunks = band.chunkDocumentText("Section one\n\nSection two");
    const vectors = await band.generateEmbeddings(chunks);
    expect(vectors.length).toBe(chunks.length);
  });
});

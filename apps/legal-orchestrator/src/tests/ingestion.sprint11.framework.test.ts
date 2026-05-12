// Sprint 11 — consolidated framework checks (fixtures only, no network / no DATABASE_URL).

import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normaliseDocument,
  chunkDocument,
  extractCitations,
  runIngestionPipeline,
} from "../ingestion";
import type { NormalisedLegalDocument, RawLegalDocument, TrustedSource } from "../ingestion/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sprint11Files = [
  "types.ts",
  "sourceRegistry.ts",
  "normaliseDocument.ts",
  "chunkDocument.ts",
  "citationExtractor.ts",
  "ingestionPipeline.ts",
  "index.ts",
];

function srcPath(name: string): string {
  return join(__dirname, "../ingestion", name);
}

const TRUSTED: TrustedSource = {
  id: "fixture-leg",
  name: "legislation.gov.uk",
  sourceType: "legislation",
  baseUrl: "https://www.legislation.gov.uk",
  jurisdiction: "UK",
  trustLevel: "primary_law",
  enabled: true,
};

function raw(over: Partial<RawLegalDocument> = {}): RawLegalDocument {
  return {
    title: "ERA 1996",
    canonicalUrl: "https://www.legislation.gov.uk/ukpga/1996/18/section/95",
    documentType: "statute",
    jurisdiction: "UK",
    rawText:
      "Employment Rights Act 1996 applies. Equality Act 2010 s. 13. ACAS Code of Practice on Disciplinary and Grievance Procedures. Section 98(1)(b). [2024] UKSC 1.",
    ...over,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Sprint 11 — static safety (no forbidden clients in module files)", () => {
  it("Sprint 11 ingestion files contain no fetch/axios/http client calls", () => {
    const banned = [/\bfetch\s*\(/, /\baxios\b/, /http\.request/, /https\.request/, /\bopenai\b/i, /\bollama\b/i];
    for (const f of sprint11Files) {
      const body = readFileSync(srcPath(f), "utf8");
      for (const re of banned) {
        expect(body).not.toMatch(re);
      }
    }
  });
});

describe("Sprint 11 — normalise + chunk + citations (fixtures)", () => {
  it("respects INGESTION_MAX_RAW_CHARS for oversized raw bodies", () => {
    vi.stubEnv("INGESTION_MAX_RAW_CHARS", "50");
    const big = "x".repeat(60);
    const out = normaliseDocument(raw({ rawText: big }), TRUSTED);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("document_too_large");
  });

  it("chunkDocument yields strictly ascending chunkIndex (ordered chunks)", () => {
    const norm = normaliseDocument(raw(), TRUSTED);
    expect(norm.ok).toBe(true);
    if (!norm.ok) return;
    const chunks = chunkDocument(norm.document, { maxWords: 12, overlapWords: 2 });
    expect(chunks.length).toBeGreaterThan(1);
    const idx = chunks.map((c) => c.chunkIndex);
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
    expect(new Set(idx).size).toBe(idx.length);
  });

  it("detects Employment Rights Act 1996, Equality Act 2010, ACAS code, section refs, neutral citation", () => {
    const norm = normaliseDocument(raw(), TRUSTED);
    expect(norm.ok).toBe(true);
    if (!norm.ok) return;
    const chunks = chunkDocument(norm.document, { maxWords: 200 });
    const cites = extractCitations(norm.document, chunks);
    const texts = cites.map((c) => c.citationText.toLowerCase());
    expect(texts.some((t) => t.includes("employment rights act 1996"))).toBe(true);
    expect(texts.some((t) => t.includes("equality act 2010"))).toBe(true);
    expect(cites.some((c) => c.citationType === "acas_code")).toBe(true);
    expect(cites.some((c) => c.citationType === "section_reference")).toBe(true);
    expect(cites.some((c) => c.citationType === "neutral_citation")).toBe(true);
  });
});

describe("Sprint 11 — chunkDocument API on NormalisedLegalDocument", () => {
  it("chunkDocument(normalised) is an alias path compatible with chunkLegalDocument", () => {
    const doc: NormalisedLegalDocument = {
      sourceId: "s",
      title: "t",
      canonicalUrl: "https://www.legislation.gov.uk/x",
      documentType: "statute",
      jurisdiction: "UK",
      contentHash: "abc",
      cleanText: "# H1\n\npara one words here.\n\n## H2\n\npara two more words for chunking.",
      metadata: {},
    };
    const chunks = chunkDocument(doc, { maxWords: 12, overlapWords: 2 });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].chunkIndex).toBe(0);
  });
});

// Sprint 11 — regex-based citation extractor tests.
// No network, no LLM.

import { describe, it, expect } from "vitest";
import { extractCitations } from "../ingestion/citationExtractor";
import type {
  LegalDocumentChunk,
  NormalisedLegalDocument,
} from "../ingestion/types";

function doc(text: string): NormalisedLegalDocument {
  return {
    sourceId: "legislation_gov_uk",
    title: "test",
    canonicalUrl: "https://www.legislation.gov.uk/ukpga/1996/18",
    documentType: "statute",
    jurisdiction: "uk",
    contentHash: "fake-hash",
    cleanText: text,
    metadata: {},
  };
}

function emptyChunks(): LegalDocumentChunk[] {
  return [];
}

describe("extractCitations", () => {
  it("detects Employment Rights Act 1996", () => {
    const c = extractCitations(doc("Under the Employment Rights Act 1996 an employee can claim."), emptyChunks());
    expect(c.some((x) => x.statuteTitle === "Employment Rights Act 1996")).toBe(true);
  });

  it("detects Equality Act 2010", () => {
    const c = extractCitations(doc("See the Equality Act 2010 section 13."), emptyChunks());
    expect(c.some((x) => x.statuteTitle === "Equality Act 2010")).toBe(true);
  });

  it("detects ACAS Code of Practice", () => {
    const c = extractCitations(
      doc("The ACAS Code of Practice on Disciplinary and Grievance Procedures applies."),
      emptyChunks()
    );
    expect(c.some((x) => x.citationType === "acas_code")).toBe(true);
  });

  it("detects 'Section 98' and 's. 98(4)' references", () => {
    const c = extractCitations(doc("See Section 98(4) and also s. 95."), emptyChunks());
    const refs = c.filter((x) => x.citationType === "section_reference").map((x) => x.sectionReference);
    expect(refs).toEqual(expect.arrayContaining(["98(4)", "95"]));
  });

  it("detects 'regulation 4' references", () => {
    const c = extractCitations(doc("See regulation 4(2) of the Working Time Regulations."), emptyChunks());
    expect(c.some((x) => x.citationType === "regulation" && x.sectionReference === "4(2)")).toBe(true);
  });

  it("detects neutral citations [YYYY] COURT N", () => {
    const c = extractCitations(
      doc("See [2024] UKSC 1 and also [2023] EWCA Civ 123 and [2022] EAT 99."),
      emptyChunks()
    );
    const neutrals = c.filter((x) => x.citationType === "neutral_citation").map((x) => x.neutralCitation);
    expect(neutrals).toEqual(
      expect.arrayContaining([
        expect.stringContaining("UKSC 1"),
        expect.stringContaining("EWCA Civ 123"),
        expect.stringContaining("EAT 99"),
      ])
    );
  });

  it("deduplicates the same citation appearing twice", () => {
    const c = extractCitations(
      doc("Employment Rights Act 1996. Then again: Employment Rights Act 1996."),
      emptyChunks()
    );
    const era = c.filter((x) => x.statuteTitle === "Employment Rights Act 1996");
    expect(era.length).toBe(1);
  });

  it("returns [] for empty text", () => {
    const c = extractCitations(doc(""), emptyChunks());
    expect(c).toEqual([]);
  });

  it("attaches chunk_index in metadata when scanning chunks", () => {
    const chunks: LegalDocumentChunk[] = [
      {
        chunkIndex: 0,
        headingPath: [],
        chunkText: "Equality Act 2010 governs discrimination.",
        tokenCount: 5,
        metadata: {},
      },
      {
        chunkIndex: 1,
        headingPath: [],
        chunkText: "See [2024] UKSC 1.",
        tokenCount: 5,
        metadata: {},
      },
    ];
    const c = extractCitations(doc("no citations in doc body"), chunks);
    const withIdx = c.filter((x) => typeof x.metadata?.chunk_index === "number");
    expect(withIdx.length).toBeGreaterThan(0);
  });
});

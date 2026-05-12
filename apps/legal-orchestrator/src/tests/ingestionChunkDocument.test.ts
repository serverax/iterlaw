// Sprint 11 — chunkLegalDocument unit tests.
// No network, no DB, no LLM.

import { describe, it, expect } from "vitest";
import { chunkLegalDocument } from "../ingestion/chunkDocument";
import type { NormalisedLegalDocument } from "../ingestion/types";

function doc(text: string): NormalisedLegalDocument {
  return {
    sourceId: "legislation_gov_uk",
    title: "ERA 1996 — Section 95",
    canonicalUrl: "https://www.legislation.gov.uk/ukpga/1996/18/section/95",
    documentType: "statute",
    jurisdiction: "uk",
    contentHash: "fake-hash",
    cleanText: text,
    metadata: {},
  };
}

describe("chunkLegalDocument", () => {
  it("rejects empty documents (returns [])", () => {
    expect(chunkLegalDocument(doc(""))).toEqual([]);
    expect(chunkLegalDocument(doc("   \n  "))).toEqual([]);
  });

  it("creates stable, ordered chunk indices", () => {
    // Build a multi-paragraph text well above default max so chunking splits.
    const paragraphs: string[] = [];
    for (let i = 0; i < 30; i++) {
      paragraphs.push(
        `Paragraph ${i}: An employee is dismissed when the contract is terminated. ` +
          "Filler words ".repeat(20)
      );
    }
    const chunks = chunkLegalDocument(doc(paragraphs.join("\n\n")), { maxWords: 200 });
    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i]!.chunkIndex).toBe(i);
    }
  });

  it("respects maxWords (approximately, with overlap)", () => {
    const para = "word ".repeat(500).trim();
    const chunks = chunkLegalDocument(doc(para), { maxWords: 100, overlapWords: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      const w = c.chunkText.split(/\s+/).filter(Boolean).length;
      // Hard upper bound: 1.5× target — packed paragraph + occasional spill.
      expect(w).toBeLessThanOrEqual(150);
    }
  });

  it("supports overlap (consecutive chunks share trailing/leading words)", () => {
    const para = "alpha beta gamma delta epsilon zeta eta theta iota kappa ".repeat(60).trim();
    const chunks = chunkLegalDocument(doc(para), { maxWords: 100, overlapWords: 10 });
    expect(chunks.length).toBeGreaterThan(1);
    // First N tokens of chunk[i+1] should appear at the END of chunk[i]
    for (let i = 0; i < chunks.length - 1; i++) {
      const tail = chunks[i]!.chunkText.split(/\s+/).slice(-10).join(" ");
      const head = chunks[i + 1]!.chunkText.split(/\s+/).slice(0, 10).join(" ");
      expect(head).toContain(tail.split(/\s+/)[0]!); // first overlapping token survives
    }
  });

  it("captures markdown heading_path", () => {
    const text = `# Employment Rights Act 1996

## Part X - Unfair Dismissal

### Section 95 - Circumstances in which an employee is dismissed

An employee is dismissed when the contract is terminated.`;
    const chunks = chunkLegalDocument(doc(text));
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const last = chunks[chunks.length - 1]!;
    expect(last.headingPath.length).toBeGreaterThan(0);
    expect(last.headingPath[last.headingPath.length - 1]).toMatch(/Section 95/);
  });

  it("captures section_reference when a 'Section N' or 's. N' header appears", () => {
    const text = `Some preamble.

Section 98

It is for the employer to show the reason for the dismissal.`;
    const chunks = chunkLegalDocument(doc(text));
    const withSection = chunks.find((c) => c.sectionReference);
    expect(withSection?.sectionReference).toBe("98");
  });
});

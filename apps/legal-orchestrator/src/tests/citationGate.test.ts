import { describe, it, expect } from "vitest";
import { StructuralCitationVerifier } from "../pipeline/verifyCitations";
import type { RagChunk, Citation } from "../types/legal";

const sources: RagChunk[] = [
  {
    chunk_id: "c1",
    document_id: "d1",
    source_type: "statute",
    authority_level: 100,
    title: "Employment Rights Act 1996",
    url: "https://legislation.gov.uk/ukpga/1996/18",
    section_reference: "98",
    chunk_text: "An employer shall have regard to the reason or principal reason for the dismissal...",
    score: 0.9,
  },
];

describe("StructuralCitationVerifier", () => {
  it("fails when there are no declared citations", async () => {
    const v = new StructuralCitationVerifier();
    const r = await v.verify({ answer: "Some legal claim.", sources, declaredCitations: [] });
    expect(r.pass).toBe(false);
    expect(r.failures).toContain("citation_missing");
  });

  it("fails when a declared citation references an unknown chunk", async () => {
    const v = new StructuralCitationVerifier();
    const bad: Citation[] = [
      {
        chunk_id: "does-not-exist",
        document_id: "d?",
        source_type: "statute",
        source_title: "?",
        source_url: "?",
        authority_level: 100,
      },
    ];
    const r = await v.verify({ answer: "x", sources, declaredCitations: bad });
    expect(r.pass).toBe(false);
    expect(r.failures.some((f) => f.startsWith("chunk_not_found"))).toBe(true);
  });

  it("passes when citation matches an existing chunk", async () => {
    const v = new StructuralCitationVerifier();
    const good: Citation[] = [
      {
        chunk_id: "c1",
        document_id: "d1",
        source_type: "statute",
        source_title: "Employment Rights Act 1996",
        source_url: "https://legislation.gov.uk/ukpga/1996/18",
        authority_level: 100,
      },
    ];
    const r = await v.verify({ answer: "x", sources, declaredCitations: good });
    expect(r.pass).toBe(true);
    expect(r.citations).toHaveLength(1);
  });

  it("fails when quote_text is not present in chunk_text", async () => {
    const v = new StructuralCitationVerifier();
    const bad: Citation[] = [
      {
        chunk_id: "c1",
        document_id: "d1",
        source_type: "statute",
        source_title: "ERA",
        source_url: "?",
        authority_level: 100,
        quote_text: "Phrase that does not appear in chunk",
      },
    ];
    const r = await v.verify({ answer: "x", sources, declaredCitations: bad });
    expect(r.pass).toBe(false);
    expect(r.failures.some((f) => f.startsWith("quote_not_supported"))).toBe(true);
  });
});

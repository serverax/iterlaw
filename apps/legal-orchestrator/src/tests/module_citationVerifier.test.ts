import { describe, it, expect } from "vitest";
import { citationVerifier } from "../modules/citationVerifier";
import type { RetrievedChunk } from "../modules/contracts";

const chunks: RetrievedChunk[] = [
  {
    chunk_id: "c1",
    source_type: "legislation",
    citation_label: "ERA 1996 s.95",
    chunk_text: "An employee is dismissed when the contract is terminated by the employer.",
    authority_level: 100,
  },
];

describe("citationVerifier", () => {
  it("rejects answers with no citations", () => {
    const r = citationVerifier({
      answer_text: "You may have a claim under the Employment Rights Act.",
      citations: [],
      retrieved_chunks: chunks,
    });
    expect(r.pass).toBe(false);
    expect(r.failures).toContain("citation_missing");
    expect(r.failures).toContain("answer_makes_claims_without_citations");
  });

  it("rejects citations referencing unknown chunks", () => {
    const r = citationVerifier({
      answer_text: "Some claim.",
      citations: [{ chunk_id: "does-not-exist" }],
      retrieved_chunks: chunks,
    });
    expect(r.pass).toBe(false);
    expect(r.failures.some((f) => f.startsWith("chunk_not_found"))).toBe(true);
  });

  it("rejects quote_text not present in the source chunk", () => {
    const r = citationVerifier({
      answer_text: "Some claim.",
      citations: [{ chunk_id: "c1", quote_text: "not in any chunk" }],
      retrieved_chunks: chunks,
    });
    expect(r.pass).toBe(false);
    expect(r.failures.some((f) => f.startsWith("quote_not_supported"))).toBe(true);
  });

  it("accepts valid citation with matching quote", () => {
    const r = citationVerifier({
      answer_text: "The employer terminated the contract.",
      citations: [{ chunk_id: "c1", quote_text: "terminated by the employer" }],
      retrieved_chunks: chunks,
    });
    expect(r.pass).toBe(true);
    expect(r.verified_chunk_ids).toEqual(["c1"]);
  });
});

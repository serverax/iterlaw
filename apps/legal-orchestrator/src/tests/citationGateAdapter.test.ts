import { describe, expect, it } from "vitest";

import { runHardenedCitationGate } from "../citations/citationGateAdapter";

const NOW = "2026-05-14";

function chunk(overrides: Partial<{
  chunk_id: string;
  chunk_text: string;
  source_type: string;
  source_id: string;
  title: string | null;
  url: string | null;
  effective_date: string | null;
  applicable_to: string | null;
  authority_level: number | null;
}> = {}) {
  return {
    chunk_id: "c-1",
    chunk_text: "An employee has the right not to be unfairly dismissed by his employer.",
    source_type: "statutory_source",
    source_id: "doc-1",
    title: "Employment Rights Act 1996",
    url: "https://www.legislation.gov.uk/ukpga/1996/18/section/94",
    effective_date: "1996-05-22",
    applicable_to: null,
    authority_level: 90,
    ...overrides,
  };
}

describe("runHardenedCitationGate", () => {
  it("blocks an answer with legal-claim words and no citations", () => {
    const out = runHardenedCitationGate({
      answerText: "Under ERA 1996 the employee was unfairly dismissed.",
      citations: [],
      retrievedChunks: [],
      nowIsoDate: NOW,
    });
    expect(out.hardBlocked).toBe(true);
    expect(out.overallStatus).toBe("blocked_no_citation");
    expect(out.decisionTrace).toContain("citation_gate:entered");
  });

  it("passes a fully-cited claim from a statutory source", () => {
    const out = runHardenedCitationGate({
      answerText: "Section 94 ERA 1996 confers the right not to be unfairly dismissed.",
      citations: [{ chunk_id: "c-1" }],
      retrievedChunks: [chunk()],
      nowIsoDate: NOW,
      trustScores: new Map([["c-1", 0.9]]),
    });
    expect(out.hardBlocked).toBe(false);
    expect(out.needsReview).toBe(false);
    expect(out.overallStatus).toBe("fully_cited");
  });

  it("blocks stale source when not in historical mode", () => {
    const out = runHardenedCitationGate({
      answerText: "Section 94.",
      citations: [{ chunk_id: "c-1" }],
      retrievedChunks: [chunk({ applicable_to: "2010-01-01" })],
      nowIsoDate: NOW,
    });
    expect(out.hardBlocked).toBe(true);
    expect(out.overallStatus).toBe("blocked_stale");
  });

  it("allows stale source with needs_review when historicalMode is true", () => {
    const out = runHardenedCitationGate({
      answerText: "Section 94.",
      citations: [{ chunk_id: "c-1" }],
      retrievedChunks: [chunk({ applicable_to: "2010-01-01" })],
      nowIsoDate: NOW,
      historicalMode: true,
    });
    expect(out.hardBlocked).toBe(false);
    expect(out.needsReview).toBe(true);
    expect(out.overallStatus).toBe("needs_review");
  });

  it("flags weak-trust source as needs_review", () => {
    const out = runHardenedCitationGate({
      answerText: "Section 94.",
      citations: [{ chunk_id: "c-1" }],
      retrievedChunks: [chunk()],
      nowIsoDate: NOW,
      trustScores: new Map([["c-1", 0.3]]),
    });
    expect(out.hardBlocked).toBe(false);
    expect(out.needsReview).toBe(true);
  });

  it("blocks an answer whose citation has no source URL", () => {
    const out = runHardenedCitationGate({
      answerText: "Statutory rights apply.",
      citations: [{ chunk_id: "c-1" }],
      retrievedChunks: [chunk({ url: null })],
      nowIsoDate: NOW,
    });
    expect(out.hardBlocked).toBe(true);
    expect(out.overallStatus).toBe("blocked_no_source");
  });

  it("accepts the alternative camelCase citation shape (chunkId / quoteText)", () => {
    const out = runHardenedCitationGate({
      answerText: "Statutory text.",
      citations: [{ chunkId: "c-1", quoteText: "An employee has the right" }],
      retrievedChunks: [chunk()],
      nowIsoDate: NOW,
      trustScores: new Map([["c-1", 0.9]]),
    });
    expect(out.hardBlocked).toBe(false);
  });

  it("decision trace records the status and pack reason codes", () => {
    const out = runHardenedCitationGate({
      answerText: "Section 94.",
      citations: [{ chunk_id: "c-1" }],
      retrievedChunks: [chunk()],
      nowIsoDate: NOW,
      trustScores: new Map([["c-1", 0.9]]),
    });
    expect(out.decisionTrace[0]).toBe("citation_gate:entered");
    expect(out.decisionTrace.some((c) => c.startsWith("citation_gate:status:"))).toBe(true);
  });
});

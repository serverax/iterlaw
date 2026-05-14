import { describe, expect, it } from "vitest";

import { verifyCitationsHardened } from "../citations/citationVerifier";
import { buildEvidencePack } from "../citations/evidencePackBuilder";
import type { RetrievalCandidate } from "../intelligence/intelligence.types";

const NOW = "2026-05-14";

function mkCandidate(overrides: Partial<RetrievalCandidate>): RetrievalCandidate {
  return {
    candidate_id: "c-1",
    source_type: "statutory_source",
    source_id: "doc-1",
    source_title: "Employment Rights Act 1996",
    source_url: "https://www.legislation.gov.uk/ukpga/1996/18/section/94",
    text: "An employee has the right not to be unfairly dismissed by his employer.",
    effective_from: "1996-05-22",
    effective_to: null,
    last_verified_at: "2026-01-01",
    superseded_by: null,
    qa_status: "approved",
    authority_level: 90,
    keyword_rank: 1,
    vector_rank: null,
    reason_codes: [],
    ...overrides,
  };
}

describe("verifyCitationsHardened", () => {
  it("refuses an answer with legal-claim words and zero citations", () => {
    const out = verifyCitationsHardened({
      answerText: "Under ERA 1996 the employee was unfairly dismissed.",
      citations: [],
      retrievedCandidates: [],
      nowIsoDate: NOW,
    });
    expect(out.pass).toBe(false);
    expect(out.overallStatus).toBe("blocked_no_citation");
    expect(out.failures).toContain("answer_makes_claims_without_citations");
  });

  it("refuses a citation whose chunk is not in the retrieved set", () => {
    const out = verifyCitationsHardened({
      answerText: "See section 94.",
      citations: [{ chunk_id: "ghost-chunk" }],
      retrievedCandidates: [mkCandidate({ candidate_id: "real-chunk" })],
      nowIsoDate: NOW,
    });
    expect(out.pass).toBe(false);
    expect(out.perCitation[0]?.status).toBe("blocked_chunk_not_found");
  });

  it("refuses a citation whose quoted text is not in the chunk", () => {
    const out = verifyCitationsHardened({
      answerText: "The Act says no.",
      citations: [{ chunk_id: "c-1", quote_text: "this quote does not appear" }],
      retrievedCandidates: [mkCandidate({})],
      nowIsoDate: NOW,
    });
    expect(out.pass).toBe(false);
    expect(out.perCitation[0]?.status).toBe("blocked_quote_not_supported");
  });

  it("refuses a citation whose candidate has no source_url", () => {
    const out = verifyCitationsHardened({
      answerText: "Statutory rights apply.",
      citations: [{ chunk_id: "c-1" }],
      retrievedCandidates: [mkCandidate({ source_url: null })],
      nowIsoDate: NOW,
    });
    expect(out.pass).toBe(false);
    expect(out.perCitation[0]?.status).toBe("blocked_no_source");
  });

  it("refuses a stale citation when historicalMode is false", () => {
    const out = verifyCitationsHardened({
      answerText: "Statutory rights apply.",
      citations: [{ chunk_id: "c-1" }],
      retrievedCandidates: [mkCandidate({ effective_to: "2010-01-01" })],
      nowIsoDate: NOW,
    });
    expect(out.pass).toBe(false);
    expect(out.perCitation[0]?.status).toBe("blocked_stale");
  });

  it("allows a stale citation when historicalMode is true but flags needs_review", () => {
    const out = verifyCitationsHardened({
      answerText: "Statutory rights apply.",
      citations: [{ chunk_id: "c-1" }],
      retrievedCandidates: [mkCandidate({ superseded_by: "c-newer" })],
      nowIsoDate: NOW,
      historicalMode: true,
    });
    expect(out.pass).toBe(true);
    expect(out.perCitation[0]?.status).toBe("needs_review");
    expect(out.overallStatus).toBe("needs_review");
  });

  it("flags weak trust as needs_review (trust between 0 and minTrust)", () => {
    const out = verifyCitationsHardened({
      answerText: "Statutory rights apply.",
      citations: [{ chunk_id: "c-1" }],
      retrievedCandidates: [mkCandidate({})],
      nowIsoDate: NOW,
      trustScores: new Map([["c-1", 0.3]]),
    });
    expect(out.pass).toBe(true);
    expect(out.perCitation[0]?.status).toBe("needs_review");
    expect(out.overallStatus).toBe("needs_review");
  });

  it("blocks trust=0 as blocked_low_trust", () => {
    const out = verifyCitationsHardened({
      answerText: "Statutory rights apply.",
      citations: [{ chunk_id: "c-1" }],
      retrievedCandidates: [mkCandidate({})],
      nowIsoDate: NOW,
      trustScores: new Map([["c-1", 0]]),
    });
    expect(out.pass).toBe(false);
    expect(out.perCitation[0]?.status).toBe("blocked_low_trust");
  });

  it("passes a fully-cited claim with strong trust and a supporting source", () => {
    const out = verifyCitationsHardened({
      answerText: "Section 94 ERA 1996 confers the right not to be unfairly dismissed.",
      citations: [{ chunk_id: "c-1" }],
      retrievedCandidates: [mkCandidate({})],
      nowIsoDate: NOW,
      trustScores: new Map([["c-1", 0.9]]),
    });
    expect(out.pass).toBe(true);
    expect(out.overallStatus).toBe("fully_cited");
    expect(out.perCitation[0]?.status).toBe("fully_cited");
  });
});

describe("buildEvidencePack", () => {
  it("returns an empty pack with blocked_no_citation when nothing is cited", () => {
    const pack = buildEvidencePack({
      answerText: "Under ERA 1996 the employee was unfairly dismissed.",
      citations: [],
      retrievedCandidates: [],
      nowIsoDate: NOW,
    });
    expect(pack.entries).toHaveLength(0);
    expect(pack.overallStatus).toBe("blocked_no_citation");
    expect(pack.reasonCodes).toContain("evidence_pack:blocked_no_citation");
  });

  it("returns one entry per citation, populated from the retrieved candidate", () => {
    const pack = buildEvidencePack({
      answerText: "Section 94.",
      citations: [{ chunk_id: "c-1" }],
      retrievedCandidates: [mkCandidate({})],
      nowIsoDate: NOW,
      trustScores: new Map([["c-1", 0.9]]),
    });
    expect(pack.entries).toHaveLength(1);
    const entry = pack.entries[0]!;
    expect(entry).toMatchObject({
      source_id: "doc-1",
      source_title: "Employment Rights Act 1996",
      source_url: "https://www.legislation.gov.uk/ukpga/1996/18/section/94",
      source_type: "statutory_source",
      effective_from: "1996-05-22",
      chunk_id: "c-1",
      citation_status: "fully_cited",
      claim_supported: true,
    });
    expect(pack.overallStatus).toBe("fully_cited");
  });

  it("marks claim_supported false when the citation is blocked", () => {
    const pack = buildEvidencePack({
      answerText: "Foo.",
      citations: [{ chunk_id: "c-1", quote_text: "does not appear" }],
      retrievedCandidates: [mkCandidate({})],
      nowIsoDate: NOW,
    });
    expect(pack.entries[0]?.citation_status).toBe("blocked_quote_not_supported");
    expect(pack.entries[0]?.claim_supported).toBe(false);
  });

  it("preserves all required pack fields", () => {
    const pack = buildEvidencePack({
      answerText: "Statutory rights apply.",
      citations: [{ chunk_id: "c-1" }],
      retrievedCandidates: [mkCandidate({})],
      nowIsoDate: NOW,
    });
    const entry = pack.entries[0]!;
    // The spec lists 12 fields; ensure each name appears as a key.
    const expectedKeys = [
      "source_id",
      "source_title",
      "source_url",
      "source_type",
      "effective_from",
      "effective_to",
      "trust_score",
      "chunk_id",
      "claim_supported",
      "citation_status",
      "warnings",
      "reason_codes",
    ];
    for (const k of expectedKeys) {
      expect(entry).toHaveProperty(k);
    }
  });
});

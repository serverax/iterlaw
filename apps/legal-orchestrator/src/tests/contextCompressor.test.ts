// Sprint 14 — context compressor tests.

import { describe, expect, it } from "vitest";
import { compressEvidence } from "../intelligence/contextCompressor";
import type {
  FreshnessAssessment,
  RetrievalCandidate,
  TrustScore,
} from "../intelligence/intelligence.types";

const cand: RetrievalCandidate = {
  candidate_id: "c1",
  source_type: "statutory_source",
  source_id: "ERA-1996-s94",
  source_title: "Employment Rights Act 1996 s.94",
  source_url: "https://www.legislation.gov.uk/ukpga/1996/18/section/94",
  text: "An employee has the right not to be unfairly dismissed by his employer.",
  effective_from: "1996-08-22",
  effective_to: null,
  last_verified_at: "2026-01-01",
  qa_status: "approved",
  authority_level: 100,
  keyword_rank: 1,
  vector_rank: 1,
  reason_codes: [],
};

const trust: TrustScore = {
  candidate_id: "c1",
  score: 100,
  source_type: "statutory_source",
  reason_codes: ["source_type:statutory_source"],
};

const fresh: FreshnessAssessment = {
  candidate_id: "c1",
  status: "fresh",
  effective_from: "1996-08-22",
  effective_to: null,
  superseded_by: null,
  reason_codes: ["fresh_within_effective_window"],
};

describe("Sprint 14 — context compressor", () => {
  it("preserves source id, title, url, type, effective dates", () => {
    const b = compressEvidence(cand, trust, fresh);
    expect(b.source_id).toBe("ERA-1996-s94");
    expect(b.source_title).toContain("Employment Rights Act 1996");
    expect(b.source_url).toContain("legislation.gov.uk");
    expect(b.source_type).toBe("statutory_source");
    expect(b.effective_from).toBe("1996-08-22");
    expect(b.trust_score).toBe(100);
  });

  it("never invents text — evidence_text is a substring of candidate.text", () => {
    const b = compressEvidence(cand, trust, fresh, { max_evidence_chars: 1000 });
    expect(cand.text.startsWith(b.evidence_text.replace(/ …$/, ""))).toBe(true);
  });

  it("emits warning when truncation occurs", () => {
    const longCand: RetrievalCandidate = { ...cand, text: "A".repeat(2000) };
    const b = compressEvidence(longCand, trust, fresh, { max_evidence_chars: 100 });
    expect(b.evidence_text.length).toBeLessThanOrEqual(200);
    expect(b.warnings).toContain("evidence_truncated_to_max_chars");
  });

  it("warns when source_title or source_url missing", () => {
    const noMeta: RetrievalCandidate = { ...cand, source_title: null, source_url: null };
    const b = compressEvidence(noMeta, trust, fresh);
    expect(b.warnings).toContain("missing_source_title");
    expect(b.warnings).toContain("missing_source_url");
  });

  it("confidence drops to 0 when freshness is stale_effective_to_passed", () => {
    const stale: FreshnessAssessment = { ...fresh, status: "stale_effective_to_passed" };
    const b = compressEvidence(cand, trust, stale);
    expect(b.confidence).toBe(0);
  });

  it("legal source without effective_from emits warning", () => {
    const noDates: RetrievalCandidate = { ...cand, effective_from: null };
    const b = compressEvidence(noDates, trust, fresh);
    expect(b.warnings).toContain("missing_effective_from_on_legal_source");
  });
});

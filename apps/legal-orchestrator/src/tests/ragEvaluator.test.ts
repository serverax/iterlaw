// Sprint 14 — RAG evaluator tests.

import { describe, expect, it } from "vitest";
import { evaluateRag } from "../intelligence/ragEvaluator";
import type {
  CompressedEvidenceBlock,
  FreshnessAssessment,
  TrustScore,
} from "../intelligence/intelligence.types";

function evi(over: Partial<CompressedEvidenceBlock> = {}): CompressedEvidenceBlock {
  return {
    source_id: "s1",
    source_title: "Source 1",
    source_url: null,
    source_type: "statutory_source",
    effective_from: "2020-01-01",
    effective_to: null,
    trust_score: 100,
    evidence_text: "x",
    supports_legal_issue: null,
    confidence: 1,
    warnings: [],
    ...over,
  };
}

function trust(score: number, id = "s1"): TrustScore {
  return { candidate_id: id, score, source_type: "statutory_source", reason_codes: [] };
}

function fresh(): FreshnessAssessment {
  return {
    candidate_id: "s1",
    status: "fresh",
    effective_from: null,
    effective_to: null,
    superseded_by: null,
    reason_codes: [],
  };
}

describe("Sprint 14 — RAG evaluator legal mode", () => {
  it("blocks when no evidence at all", () => {
    const r = evaluateRag([], [], [], { legal_mode: true });
    expect(r.block_recommended).toBe(true);
    expect(r.uncited_legal_claim_detected).toBe(true);
  });

  it("blocks when an answer claim is uncited", () => {
    const r = evaluateRag(
      [evi()],
      [trust(100)],
      [fresh()],
      {
        legal_mode: true,
        answer_legal_claims: [
          { claim_id: "c1", cited_source_ids: ["NOT-PRESENT"] },
        ],
      },
    );
    expect(r.block_recommended).toBe(true);
    expect(r.uncited_legal_claim_detected).toBe(true);
  });

  it("needs_review when trust below threshold", () => {
    const r = evaluateRag(
      [evi({ trust_score: 50 })],
      [trust(50)],
      [fresh()],
      { legal_mode: true },
    );
    expect(r.needs_review).toBe(true);
    expect(r.trust_threshold_met).toBe(false);
  });

  it("blocks when stale legal source present", () => {
    const r = evaluateRag(
      [evi()],
      [trust(100)],
      [
        {
          candidate_id: "s1",
          status: "stale_effective_to_passed",
          effective_from: null,
          effective_to: "2010-01-01",
          superseded_by: null,
          reason_codes: [],
        },
      ],
      { legal_mode: true },
    );
    expect(r.freshness_ok).toBe(false);
    expect(r.block_recommended).toBe(true);
  });

  it("proceeds when fresh statutory evidence and claim covered", () => {
    const r = evaluateRag(
      [evi()],
      [trust(100)],
      [fresh()],
      {
        legal_mode: true,
        answer_legal_claims: [
          { claim_id: "c1", cited_source_ids: ["s1"] },
        ],
      },
    );
    expect(r.block_recommended).toBe(false);
    expect(r.needs_review).toBe(false);
    expect(r.citation_coverage).toBe(1);
  });
});

describe("Sprint 14 — RAG evaluator non-legal mode", () => {
  it("does not block on stale freshness alone for non-legal", () => {
    const r = evaluateRag(
      [evi({ source_type: "approved_output" })],
      [trust(70)],
      [
        {
          candidate_id: "s1",
          status: "stale_effective_to_passed",
          effective_from: null,
          effective_to: "2010-01-01",
          superseded_by: null,
          reason_codes: [],
        },
      ],
      { legal_mode: false },
    );
    expect(r.block_recommended).toBe(false);
  });

  it("non-legal needs_review when citation coverage below 0.5", () => {
    const r = evaluateRag(
      [evi()],
      [trust(80)],
      [fresh()],
      {
        legal_mode: false,
        answer_legal_claims: [
          { claim_id: "c1", cited_source_ids: ["nope"] },
          { claim_id: "c2", cited_source_ids: ["nope2"] },
        ],
      },
    );
    expect(r.needs_review).toBe(true);
  });
});

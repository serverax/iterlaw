import { describe, expect, it } from "vitest";

import { rerankCandidates } from "../retrieval/reranker";
import type { RetrievalCandidate } from "../intelligence/intelligence.types";
import { getRerankerConfig } from "../config/featureFlags";

function mk(overrides: Partial<RetrievalCandidate>): RetrievalCandidate {
  return {
    candidate_id: "x",
    source_type: "statutory_source",
    source_id: "doc-x",
    source_title: "Generic Statutory Source",
    source_url: "https://www.legislation.gov.uk/uk/example",
    text: "...",
    effective_from: "2020-01-01",
    effective_to: null,
    last_verified_at: "2026-01-01",
    superseded_by: null,
    qa_status: "approved",
    authority_level: 90,
    keyword_rank: null,
    vector_rank: null,
    reason_codes: [],
    ...overrides,
  };
}

const NOW = "2026-05-14";

describe("rerankCandidates — ordering", () => {
  it("higher trust outranks lower trust (failed-QA falls to bottom)", () => {
    const a = mk({ candidate_id: "a", qa_status: "approved" });
    const b = mk({ candidate_id: "b", qa_status: "failed" });
    const out = rerankCandidates([b, a], { nowIsoDate: NOW });
    expect(out.ordered.map((c) => c.candidate_id)).toEqual(["a", "b"]);
  });

  it("fresh source outranks stale source (effective_to in the past)", () => {
    const fresh = mk({ candidate_id: "fresh" });
    const stale = mk({ candidate_id: "stale", effective_to: "2020-01-01" });
    const out = rerankCandidates([stale, fresh], { nowIsoDate: NOW });
    expect(out.ordered.map((c) => c.candidate_id)).toEqual(["fresh", "stale"]);
  });

  it("non-superseded outranks superseded", () => {
    const live = mk({ candidate_id: "live" });
    const superseded = mk({ candidate_id: "superseded", superseded_by: "x-newer" });
    const out = rerankCandidates([superseded, live], { nowIsoDate: NOW });
    expect(out.ordered.map((c) => c.candidate_id)).toEqual(["live", "superseded"]);
  });

  it("primary legislation outranks acas guidance (source-tier rank)", () => {
    const legislation = mk({ candidate_id: "leg", source_type: "statutory_source" });
    const acas = mk({ candidate_id: "acas", source_type: "acas_guidance" });
    const out = rerankCandidates([acas, legislation], { nowIsoDate: NOW });
    expect(out.ordered.map((c) => c.candidate_id)).toEqual(["leg", "acas"]);
  });

  it("exact-match boost lifts a candidate above an otherwise equal one", () => {
    const a = mk({ candidate_id: "a" });
    const b = mk({ candidate_id: "b" });
    const out = rerankCandidates([a, b], {
      nowIsoDate: NOW,
      exactMatchCandidateIds: new Set(["b"]),
    });
    expect(out.ordered.map((c) => c.candidate_id)).toEqual(["b", "a"]);
    const bScore = out.scores.find((s) => s.candidate_id === "b")!;
    expect(bScore.reasonCodes).toContain("reranker:exact_match");
  });

  it("jurisdiction match adds a point when the source_url carries the jurisdiction hint", () => {
    const ukRelevant = mk({ candidate_id: "uk", source_url: "https://www.legislation.gov.uk/uk/ukpga/1996/18" });
    const irrelevant = mk({ candidate_id: "other", source_url: "https://example.test/foo" });
    const out = rerankCandidates([irrelevant, ukRelevant], {
      nowIsoDate: NOW,
      jurisdiction: "UK_ENGLAND_WALES",
    });
    expect(out.ordered.map((c) => c.candidate_id)).toEqual(["uk", "other"]);
  });

  it("law-area match adds a point when the source_title carries the law-area hint", () => {
    const employment = mk({ candidate_id: "emp", source_title: "Employment Rights Act 1996" });
    const other = mk({ candidate_id: "other", source_title: "Some Other Statute" });
    const out = rerankCandidates([other, employment], {
      nowIsoDate: NOW,
      lawArea: "Employment",
    });
    expect(out.ordered.map((c) => c.candidate_id)).toEqual(["emp", "other"]);
  });

  it("complete citation metadata outranks incomplete metadata when other signals tie", () => {
    const complete = mk({ candidate_id: "complete", last_verified_at: "2026-01-01", effective_from: "2020-01-01" });
    const incomplete = mk({
      candidate_id: "incomplete",
      last_verified_at: null,
      effective_from: null,
      source_title: null,
    });
    const out = rerankCandidates([incomplete, complete], { nowIsoDate: NOW });
    expect(out.ordered[0]?.candidate_id).toBe("complete");
    const inc = out.scores.find((s) => s.candidate_id === "incomplete")!;
    expect(inc.reasonCodes).toContain("reranker:weak_citation_metadata");
  });

  it("stale + low-trust + missing metadata all stack into a sub-zero score", () => {
    const worst = mk({
      candidate_id: "worst",
      qa_status: "failed",
      superseded_by: "newer",
      source_url: null,
      source_title: null,
      effective_from: null,
      last_verified_at: null,
      source_type: "draft_ai_output",
    });
    const out = rerankCandidates([worst], { nowIsoDate: NOW });
    const score = out.scores[0]!;
    expect(score.reasonCodes).toContain("reranker:failed_qa_zero_trust");
    expect(score.reasonCodes).toContain("reranker:stale");
    expect(score.reasonCodes).toContain("reranker:low_trust");
  });

  it("stable sort preserves order on equal scores", () => {
    const a = mk({ candidate_id: "a" });
    const b = mk({ candidate_id: "b" });
    const out = rerankCandidates([a, b], { nowIsoDate: NOW });
    expect(out.ordered.map((c) => c.candidate_id)).toEqual(["a", "b"]);
  });

  it("decision trace exists for every input", () => {
    const items = [mk({ candidate_id: "1" }), mk({ candidate_id: "2", qa_status: "failed" })];
    const out = rerankCandidates(items, { nowIsoDate: NOW });
    expect(out.scores).toHaveLength(2);
    for (const s of out.scores) {
      expect(typeof s.score).toBe("number");
      expect(s.components).toBeDefined();
    }
  });
});

describe("ITERLAW_RERANKER_ENABLED feature flag", () => {
  it("defaults to OFF when env var is unset", () => {
    const prev = process.env.ITERLAW_RERANKER_ENABLED;
    delete process.env.ITERLAW_RERANKER_ENABLED;
    try {
      const cfg = getRerankerConfig();
      expect(cfg.enabled).toBe(false);
    } finally {
      if (prev !== undefined) process.env.ITERLAW_RERANKER_ENABLED = prev;
    }
  });

  it("turns ON only when env var is exactly true / 1 / yes / on", () => {
    const prev = process.env.ITERLAW_RERANKER_ENABLED;
    try {
      for (const v of ["true", "1", "yes", "on", "TRUE", "Yes"]) {
        process.env.ITERLAW_RERANKER_ENABLED = v;
        expect(getRerankerConfig().enabled).toBe(true);
      }
      for (const v of ["false", "0", "no", "off", "", "maybe"]) {
        process.env.ITERLAW_RERANKER_ENABLED = v;
        expect(getRerankerConfig().enabled).toBe(false);
      }
    } finally {
      if (prev !== undefined) process.env.ITERLAW_RERANKER_ENABLED = prev;
      else delete process.env.ITERLAW_RERANKER_ENABLED;
    }
  });
});

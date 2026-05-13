// Sprint 14 — hybrid retrieval planning + RRF tests.

import { describe, expect, it } from "vitest";
import { classifyQuery } from "../intelligence/queryClassifier";
import { planRetrieval } from "../intelligence/retrievalPlanner";
import { rrfFuse } from "../intelligence/rrfFusion";
import { hybridRetrieve } from "../intelligence/hybridRetriever";
import type { RetrievalCandidate } from "../intelligence/intelligence.types";

function cand(id: string, sourceType: RetrievalCandidate["source_type"]): RetrievalCandidate {
  return {
    candidate_id: id,
    source_type: sourceType,
    source_id: id,
    source_title: id,
    source_url: null,
    text: `text for ${id}`,
    effective_from: null,
    effective_to: null,
    qa_status: "approved",
    authority_level: null,
    keyword_rank: null,
    vector_rank: null,
    reason_codes: [],
  };
}

describe("Sprint 14 — classifier + planner", () => {
  it("classifies a legal question and plans statutory_first", () => {
    const c = classifyQuery("Was I unfairly dismissed under ERA 1996?");
    expect(c.intent).toBe("legal_question");
    const p = planRetrieval(c.intent);
    expect(p.strategy).toBe("statutory_first");
    expect(p.sources_priority[0]).toBe("statutory_source");
    expect(p.must_include_legal_temporal).toBe(true);
  });

  it("classifies a project status question and plans project_memory_first", () => {
    const c = classifyQuery("What is the current sprint status?");
    expect(c.intent).toBe("project_status");
    expect(planRetrieval(c.intent).strategy).toBe("project_memory_first");
  });

  it("falls back to unknown for noisy input", () => {
    const c = classifyQuery("blah blah random unrelated text");
    expect(c.intent).toBe("unknown");
    const p = planRetrieval(c.intent);
    expect(p.strategy).toBe("conservative_unknown");
  });

  it("legal_question dominates project_status when both keywords appear", () => {
    const c = classifyQuery("Sprint 12 status of the unfair dismissal handler");
    expect(c.intent).toBe("legal_question");
  });
});

describe("Sprint 14 — RRF fusion", () => {
  it("ranks a candidate appearing in both lists higher than singletons", () => {
    const r = rrfFuse({
      keyword_ranked: [cand("A", "statutory_source"), cand("B", "govuk_guidance")],
      vector_ranked: [cand("A", "statutory_source"), cand("C", "acas_guidance")],
    });
    expect(r.fused[0].candidate_id).toBe("A");
    expect(r.scores.A).toBeGreaterThan(r.scores.B);
    expect(r.scores.A).toBeGreaterThan(r.scores.C);
  });

  it("deduplicates by candidate_id", () => {
    const r = rrfFuse({
      keyword_ranked: [cand("A", "statutory_source")],
      vector_ranked: [cand("A", "statutory_source")],
    });
    expect(r.fused.length).toBe(1);
  });

  it("higher-ranked items score better", () => {
    const r = rrfFuse({
      keyword_ranked: [cand("first", "statutory_source"), cand("second", "statutory_source")],
      vector_ranked: [],
    });
    expect(r.scores.first).toBeGreaterThan(r.scores.second);
  });

  it("output reason codes include rrf_k and dedup info", () => {
    const r = rrfFuse({
      keyword_ranked: [cand("A", "statutory_source")],
      vector_ranked: [cand("A", "statutory_source")],
    });
    expect(r.reason_codes.some((s) => s.startsWith("rrf_k="))).toBe(true);
    expect(r.reason_codes.some((s) => s.startsWith("dedup_input="))).toBe(true);
  });
});

describe("Sprint 14 — HybridRetriever", () => {
  it("reports per_source_counts + dedup_count", () => {
    const h = hybridRetrieve({
      keyword_ranked: [cand("A", "statutory_source"), cand("B", "govuk_guidance")],
      vector_ranked: [cand("A", "statutory_source"), cand("C", "acas_guidance")],
    });
    expect(h.candidates.length).toBe(3);
    expect(h.per_source_counts.statutory_source).toBe(1);
    expect(h.per_source_counts.govuk_guidance).toBe(1);
    expect(h.per_source_counts.acas_guidance).toBe(1);
    expect(h.dedup_count).toBe(1);
  });
});

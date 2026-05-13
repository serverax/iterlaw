// Sprint 19 — Multi-tier retrieval tests.

import { describe, it, expect } from "vitest";
import {
  applyFreshnessFilter,
  applyMetadataFilter,
  applyTrustFilter,
  buildContextPack,
  fuseRrf,
  planAndExecuteMultiTier,
} from "../retrieval";
import type { RetrievalCandidate } from "../intelligence/intelligence.types";

function mkCandidate(overrides: Partial<RetrievalCandidate> = {}): RetrievalCandidate {
  return {
    candidate_id: overrides.candidate_id ?? "cand-1",
    source_type: overrides.source_type ?? "statutory_source",
    source_id: overrides.source_id ?? "ERA-1996",
    source_title: overrides.source_title ?? "ERA 1996 s94",
    source_url: overrides.source_url ?? "https://www.legislation.gov.uk/ukpga/1996/18/section/94",
    text: overrides.text ?? "Sample statutory text.",
    effective_from: overrides.effective_from ?? "1996-08-22",
    effective_to: overrides.effective_to ?? null,
    last_verified_at: overrides.last_verified_at ?? "2026-01-01",
    superseded_by: overrides.superseded_by ?? null,
    qa_status: overrides.qa_status ?? "approved",
    authority_level: overrides.authority_level ?? 1,
    keyword_rank: overrides.keyword_rank ?? null,
    vector_rank: overrides.vector_rank ?? null,
    reason_codes: overrides.reason_codes ?? [],
  };
}

describe("multi-tier retrieval — planner", () => {
  it("exact approved result outranks every other tier and short-circuits", async () => {
    const result = await planAndExecuteMultiTier(
      { question: "What is unfair dismissal under ERA 1996?", queryType: "legal_question" },
      {
        exactApprovedLookup: (q) => ({
          canonicalQuestion: q,
          answerSummary: "ERA 1996 s94 right not to be unfairly dismissed.",
          candidate: mkCandidate({ candidate_id: "exact-1", source_type: "approved_output", authority_level: 1 }),
        }),
        fullTextSearch: () => [mkCandidate({ candidate_id: "ft-1", keyword_rank: 1 })],
        vectorSearch: () => [mkCandidate({ candidate_id: "vec-1", vector_rank: 1 })],
      },
    );
    expect(result.finalCandidates).toHaveLength(1);
    expect(result.finalCandidates[0]!.candidate_id).toBe("exact-1");
    expect(result.decisionTrace).toContain("short_circuit:exact_approved_qa");
    const otherTierStatuses = result.tierResults
      .filter((t) => t.tier !== "exact_approved_qa")
      .map((t) => t.status);
    expect(otherTierStatuses.every((s) => s === "skipped")).toBe(true);
  });

  it("legal_rules_calculation selects the rules tier", async () => {
    const result = await planAndExecuteMultiTier(
      { question: "Calculate statutory redundancy pay", queryType: "legal_rules_calculation" },
      {
        rulesLookup: () => [
          {
            ruleId: "STATUTORY_REDUNDANCY_PAY",
            ruleLabel: "Statutory redundancy pay table",
            candidate: mkCandidate({ candidate_id: "rule-1", source_type: "statutory_source" }),
          },
        ],
        fullTextSearch: () => [mkCandidate({ candidate_id: "ft-1", keyword_rank: 1 })],
        vectorSearch: () => [mkCandidate({ candidate_id: "vec-1", vector_rank: 1 })],
      },
    );
    const rulesTier = result.tierResults.find((t) => t.tier === "rules_lookup");
    expect(rulesTier).toBeDefined();
    expect(rulesTier!.status).toBe("selected");
    expect(result.finalCandidates.find((c) => c.candidate_id === "rule-1")).toBeDefined();
  });

  it("normal legal_question selects full-text + vector tiers and fuses with RRF", async () => {
    const result = await planAndExecuteMultiTier(
      { question: "ACAS early conciliation effect on time limits", queryType: "legal_question" },
      {
        fullTextSearch: () => [mkCandidate({ candidate_id: "ft-1", keyword_rank: 1 })],
        vectorSearch: () => [mkCandidate({ candidate_id: "vec-1", vector_rank: 1 })],
      },
    );
    expect(result.tierResults.find((t) => t.tier === "full_text")!.status).toBe("selected");
    expect(result.tierResults.find((t) => t.tier === "vector")!.status).toBe("selected");
    expect(result.fusion).toBeDefined();
    expect(result.fusion!.candidates.length).toBeGreaterThan(0);
    expect(result.decisionTrace.some((s) => s.startsWith("tier:fused_full_text_vector"))).toBe(true);
  });

  it("stale (superseded) result is excluded outside historical mode", async () => {
    const result = await planAndExecuteMultiTier(
      { question: "Old version of redundancy pay rules", queryType: "legal_question" },
      {
        fullTextSearch: () => [
          mkCandidate({ candidate_id: "stale-1", superseded_by: "newer-1", keyword_rank: 1 }),
          mkCandidate({ candidate_id: "fresh-1", keyword_rank: 2 }),
        ],
      },
    );
    expect(result.excludedByFreshness).toContain("stale-1");
    expect(result.finalCandidates.find((c) => c.candidate_id === "stale-1")).toBeUndefined();
    expect(result.finalCandidates.find((c) => c.candidate_id === "fresh-1")).toBeDefined();
  });

  it("historical_comparison query keeps superseded result with warning", async () => {
    const result = await planAndExecuteMultiTier(
      { question: "Compare old vs new redundancy rules", queryType: "historical_comparison" },
      {
        fullTextSearch: () => [
          mkCandidate({ candidate_id: "stale-1", superseded_by: "newer-1", keyword_rank: 1 }),
        ],
      },
    );
    expect(result.excludedByFreshness).not.toContain("stale-1");
    expect(result.finalCandidates.find((c) => c.candidate_id === "stale-1")).toBeDefined();
    expect(result.decisionTrace.some((s) => s.startsWith("historical_kept"))).toBe(true);
  });

  it("low-trust (failed_qa) result is excluded from final context", async () => {
    const result = await planAndExecuteMultiTier(
      { question: "Random query", queryType: "legal_question" },
      {
        fullTextSearch: () => [
          mkCandidate({ candidate_id: "blocked-1", qa_status: "failed", keyword_rank: 1 }),
          mkCandidate({ candidate_id: "trusted-1", keyword_rank: 2 }),
        ],
      },
    );
    expect(result.excludedByTrust).toContain("blocked-1");
    expect(result.finalCandidates.find((c) => c.candidate_id === "blocked-1")).toBeUndefined();
  });

  it("decision trace is present and well-formed", async () => {
    const result = await planAndExecuteMultiTier(
      { question: "anything", queryType: "legal_question" },
      {},
    );
    expect(Array.isArray(result.decisionTrace)).toBe(true);
    expect(result.decisionTrace.length).toBeGreaterThan(0);
    expect(result.decisionTrace.some((s) => s.startsWith("tier:exact_approved_qa"))).toBe(true);
    expect(result.decisionTrace.some((s) => s.startsWith("tier:full_text"))).toBe(true);
    expect(result.decisionTrace.some((s) => s.startsWith("tier:vector"))).toBe(true);
  });
});

describe("multi-tier retrieval — RRF fusion", () => {
  it("deduplicates by candidate_id and ranks by combined RRF score", () => {
    const candidates: RetrievalCandidate[] = [
      mkCandidate({ candidate_id: "a", keyword_rank: 1 }),
      mkCandidate({ candidate_id: "b", keyword_rank: 2 }),
      mkCandidate({ candidate_id: "a", vector_rank: 1 }), // dedupe — same id, vector signal
      mkCandidate({ candidate_id: "c", vector_rank: 3 }),
    ];
    const result = fuseRrf(candidates);
    expect(result.candidates.map((c) => c.candidate_id)).toHaveLength(3);
    expect(result.candidates[0]!.candidate_id).toBe("a");
    expect(result.dedupCount).toBe(1);
  });
});

describe("multi-tier retrieval — metadata filter", () => {
  it("rejects candidates below the minimum source tier", () => {
    const candidates = [
      mkCandidate({ candidate_id: "primary", authority_level: 1 }),
      mkCandidate({ candidate_id: "commentary", authority_level: 5 }),
    ];
    const outcome = applyMetadataFilter(candidates, { minSourceTier: 4 });
    expect(outcome.accepted.map((c) => c.candidate_id)).toEqual(["primary"]);
    expect(outcome.rejected.find((r) => r.id === "commentary")?.reason).toBe("metadata_below_min_source_tier");
  });
});

describe("multi-tier retrieval — trust filter", () => {
  it("blocks failed-QA candidates with score 0", () => {
    const candidates = [
      mkCandidate({ candidate_id: "ok", qa_status: "approved" }),
      mkCandidate({ candidate_id: "blocked", qa_status: "failed" }),
    ];
    const outcome = applyTrustFilter(candidates);
    expect(outcome.accepted.map((c) => c.candidate_id)).toEqual(["ok"]);
    expect(outcome.rejected[0]!.score).toBe(0);
    expect(outcome.rejected[0]!.reason).toBe("trust_blocked_failed_qa");
  });
});

describe("multi-tier retrieval — freshness filter", () => {
  it("rejects effective_to-passed candidates when not historical mode", () => {
    const candidates = [
      mkCandidate({ candidate_id: "current", effective_to: "2099-01-01" }),
      mkCandidate({ candidate_id: "expired", effective_to: "2020-01-01" }),
    ];
    const outcome = applyFreshnessFilter(candidates, { nowIsoDate: "2026-05-13" });
    expect(outcome.accepted.map((c) => c.candidate_id)).toEqual(["current"]);
    expect(outcome.rejected.find((r) => r.id === "expired")?.reason).toBe("freshness_effective_to_passed");
  });

  it("keeps superseded candidates in historical mode and records the warning", () => {
    const candidates = [mkCandidate({ candidate_id: "old", superseded_by: "new" })];
    const outcome = applyFreshnessFilter(candidates, { historicalMode: true });
    expect(outcome.accepted.map((c) => c.candidate_id)).toEqual(["old"]);
    expect(outcome.historicalKept[0]!.reason).toBe("freshness_superseded");
  });
});

describe("multi-tier retrieval — context pack builder", () => {
  it("preserves source title/url and trims snippet length", () => {
    const cand = mkCandidate({ text: "a".repeat(5000) });
    const pack = buildContextPack([cand], { maxSnippetChars: 100 });
    expect(pack.count).toBe(1);
    expect(pack.entries[0]!.snippet.length).toBe(100);
    expect(pack.entries[0]!.sourceTitle).toBe(cand.source_title);
  });
});

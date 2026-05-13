// Sprint 19A — Feature-flagged Multi-Tier Retrieval Gateway tests.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMultiTierRetrievalConfig } from "../config/featureFlags";
import { runMultiTierRetrievalGateway } from "../retrieval/multiTierRetrievalGateway";
import type { RetrievalCandidate } from "../intelligence/intelligence.types";

const FLAG = "ITERLAW_MULTI_TIER_RETRIEVAL_ENABLED";

function mkCandidate(overrides: Partial<RetrievalCandidate> = {}): RetrievalCandidate {
  return {
    candidate_id: overrides.candidate_id ?? "c1",
    source_type: overrides.source_type ?? "statutory_source",
    source_id: overrides.source_id ?? "ERA-1996",
    source_title: overrides.source_title ?? "ERA 1996",
    source_url: overrides.source_url ?? "https://www.legislation.gov.uk/ukpga/1996/18",
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

describe("Sprint 19A — multi-tier retrieval feature flag", () => {
  const prev = process.env[FLAG];

  beforeEach(() => {
    delete process.env[FLAG];
  });

  afterEach(() => {
    if (prev === undefined) delete process.env[FLAG];
    else process.env[FLAG] = prev;
  });

  it("flag defaults to OFF when unset", () => {
    expect(getMultiTierRetrievalConfig().enabled).toBe(false);
  });

  it("flag is OFF for empty / 'false' / arbitrary text", () => {
    for (const v of ["", "false", "0", "no", "maybe"]) {
      process.env[FLAG] = v;
      expect(getMultiTierRetrievalConfig().enabled).toBe(false);
    }
  });

  it("flag is ON only for explicit 'true' / '1' / 'yes' / 'on'", () => {
    for (const v of ["true", "TRUE", "1", "yes", "on"]) {
      process.env[FLAG] = v;
      expect(getMultiTierRetrievalConfig().enabled).toBe(true);
    }
  });
});

describe("Sprint 19A — runMultiTierRetrievalGateway", () => {
  it("returns insufficient_sources when no adapters are injected (default-off path)", async () => {
    const result = await runMultiTierRetrievalGateway({
      question: "any legal question",
      queryType: "legal_question",
    });
    expect(result.hadCandidates).toBe(false);
    expect(result.insufficientSources).toBe(true);
    expect(result.finalCandidates).toEqual([]);
    expect(result.decisionTrace.length).toBeGreaterThan(1);
    expect(result.decisionTrace[0]).toBe("multi_tier_gateway:entered");
  });

  it("returns a single candidate when an exact approved match is injected", async () => {
    const exactCandidate = mkCandidate({ candidate_id: "exact-1", source_type: "approved_output" });
    const result = await runMultiTierRetrievalGateway({
      question: "unfair dismissal — definition",
      queryType: "legal_question",
      deps: {
        exactApprovedLookup: () => ({
          canonicalQuestion: "unfair dismissal — definition",
          answerSummary: "ERA 1996 s94 right not to be unfairly dismissed.",
          candidate: exactCandidate,
        }),
      },
    });
    expect(result.hadCandidates).toBe(true);
    expect(result.insufficientSources).toBe(false);
    expect(result.finalCandidates).toHaveLength(1);
    expect(result.finalCandidates[0]!.candidate_id).toBe("exact-1");
    expect(result.decisionTrace).toContain("short_circuit:exact_approved_qa");
  });

  it("excludes stale (superseded) candidates from the final set", async () => {
    const result = await runMultiTierRetrievalGateway({
      question: "old redundancy rules",
      queryType: "legal_question",
      deps: {
        fullTextSearch: () => [
          mkCandidate({ candidate_id: "stale-1", superseded_by: "newer-1", keyword_rank: 1 }),
          mkCandidate({ candidate_id: "fresh-1", keyword_rank: 2 }),
        ],
      },
    });
    expect(result.finalCandidates.find((c) => c.candidate_id === "stale-1")).toBeUndefined();
    expect(result.finalCandidates.find((c) => c.candidate_id === "fresh-1")).toBeDefined();
  });

  it("excludes low-trust (failed_qa) candidates from the final set", async () => {
    const result = await runMultiTierRetrievalGateway({
      question: "anything",
      queryType: "legal_question",
      deps: {
        fullTextSearch: () => [
          mkCandidate({ candidate_id: "blocked-1", qa_status: "failed", keyword_rank: 1 }),
          mkCandidate({ candidate_id: "trusted-1", keyword_rank: 2 }),
        ],
      },
    });
    expect(result.finalCandidates.find((c) => c.candidate_id === "blocked-1")).toBeUndefined();
  });

  it("captures a decision trace that always starts with multi_tier_gateway:entered", async () => {
    const result = await runMultiTierRetrievalGateway({
      question: "anything",
      queryType: "legal_question",
    });
    expect(result.decisionTrace[0]).toBe("multi_tier_gateway:entered");
    expect(result.decisionTrace[result.decisionTrace.length - 1]).toMatch(/^multi_tier_gateway:final_count:/);
  });

  it("gateway module has no external LLM / network imports", () => {
    const source = require("fs").readFileSync(
      require("path").join(__dirname, "..", "retrieval", "multiTierRetrievalGateway.ts"),
      "utf8",
    ) as string;
    expect(source).not.toMatch(/from\s+"axios"/);
    expect(source).not.toMatch(/from\s+"node-fetch"/);
    expect(source).not.toMatch(/import\s+["']http/);
    expect(source).not.toMatch(/import\s+["']https/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com/);
  });
});

// Sprint 14 — semantic cache key builder tests.

import { describe, expect, it } from "vitest";
import {
  buildCacheKey,
  cacheKeyEquals,
  hashEvidencePack,
  normalizeQuestion,
  INVALIDATORS,
} from "../intelligence/semanticCache";
import type {
  CompressedEvidenceBlock,
  IntelligenceRequest,
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
    evidence_text: "evidence text",
    supports_legal_issue: null,
    confidence: 1,
    warnings: [],
    ...over,
  };
}

function req(over: Partial<IntelligenceRequest> = {}): IntelligenceRequest {
  return {
    workspace_id: "w1",
    project_id: "p1",
    user_id: "u1",
    question: "What is the limitation date?",
    legal_mode: true,
    latest_event_at: "2026-05-13T00:00:00Z",
    ...over,
  };
}

describe("Sprint 14 — semantic cache key builder", () => {
  it("normalizeQuestion lower-cases and strips punctuation", () => {
    expect(normalizeQuestion(" What's the LIMITATION date?! ")).toBe(
      "what s the limitation date",
    );
  });

  it("hashEvidencePack is order-independent (same blocks, different order)", () => {
    const a = hashEvidencePack([evi({ source_id: "a" }), evi({ source_id: "b" })]);
    const b = hashEvidencePack([evi({ source_id: "b" }), evi({ source_id: "a" })]);
    expect(a).toBe(b);
  });

  it("hashEvidencePack changes when a source_id changes", () => {
    const a = hashEvidencePack([evi({ source_id: "a" })]);
    const b = hashEvidencePack([evi({ source_id: "B" })]);
    expect(a).not.toBe(b);
  });

  it("buildCacheKey includes workspace, project, normalized question, hashes", () => {
    const k = buildCacheKey({
      request: req(),
      evidence: [evi()],
      model_used: "model-X",
    });
    expect(k.workspace_id).toBe("w1");
    expect(k.project_id).toBe("p1");
    expect(k.normalized_question).toContain("limitation date");
    expect(k.retrieved_context_hash.length).toBe(64);
    expect(k.legal_mode).toBe(true);
    expect(k.model_used).toBe("model-X");
  });

  it("cacheKeyEquals returns false when latest_event_at differs", () => {
    const a = buildCacheKey({
      request: req({ latest_event_at: "2026-05-13T00:00:00Z" }),
      evidence: [evi()],
      model_used: "m",
    });
    const b = buildCacheKey({
      request: req({ latest_event_at: "2026-05-14T00:00:00Z" }),
      evidence: [evi()],
      model_used: "m",
    });
    expect(cacheKeyEquals(a, b)).toBe(false);
  });

  it("cacheKeyEquals returns false when retrieved context differs", () => {
    const a = buildCacheKey({ request: req(), evidence: [evi({ source_id: "a" })], model_used: "m" });
    const b = buildCacheKey({ request: req(), evidence: [evi({ source_id: "z" })], model_used: "m" });
    expect(cacheKeyEquals(a, b)).toBe(false);
  });

  it("cacheKeyEquals returns true for identical inputs", () => {
    const a = buildCacheKey({ request: req(), evidence: [evi()], model_used: "m" });
    const b = buildCacheKey({ request: req(), evidence: [evi()], model_used: "m" });
    expect(cacheKeyEquals(a, b)).toBe(true);
  });

  it("INVALIDATORS enumerates the canonical invalidation reasons", () => {
    expect(INVALIDATORS).toContain("law_source_changed");
    expect(INVALIDATORS).toContain("previous_answer_failed_citation_verification");
    expect(INVALIDATORS).toContain("case_facts_changed");
  });
});

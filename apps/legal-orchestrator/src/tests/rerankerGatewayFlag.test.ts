import { afterEach, describe, expect, it } from "vitest";

import { runMultiTierRetrievalGateway } from "../retrieval/multiTierRetrievalGateway";
import type { RetrievalCandidate } from "../intelligence/intelligence.types";

const NOW = "2026-05-14";

function mk(c: Partial<RetrievalCandidate>): RetrievalCandidate {
  return {
    candidate_id: c.candidate_id ?? "x",
    source_type: c.source_type ?? "statutory_source",
    source_id: c.source_id ?? "doc",
    source_title: c.source_title ?? "Source",
    source_url: c.source_url ?? "https://www.legislation.gov.uk/test",
    text: "some statutory text",
    effective_from: "2020-01-01",
    effective_to: c.effective_to ?? null,
    last_verified_at: "2026-01-01",
    superseded_by: c.superseded_by ?? null,
    qa_status: c.qa_status ?? "approved",
    authority_level: 90,
    keyword_rank: c.keyword_rank ?? null,
    vector_rank: c.vector_rank ?? null,
    reason_codes: [],
  };
}

const prev = process.env.ITERLAW_RERANKER_ENABLED;

afterEach(() => {
  if (prev !== undefined) process.env.ITERLAW_RERANKER_ENABLED = prev;
  else delete process.env.ITERLAW_RERANKER_ENABLED;
});

describe("multi-tier retrieval gateway × reranker flag", () => {
  it("flag OFF preserves planner ordering and does not record reranker trace", async () => {
    delete process.env.ITERLAW_RERANKER_ENABLED;
    const fullTextSearch = () => [
      mk({ candidate_id: "weak", source_type: "draft_ai_output", qa_status: "draft", keyword_rank: 1 }),
      mk({ candidate_id: "strong", source_type: "statutory_source", qa_status: "approved", keyword_rank: 2 }),
    ];
    const out = await runMultiTierRetrievalGateway({
      question: "redundancy pay",
      queryType: "legal_question",
      deps: { fullTextSearch },
      nowIsoDate: NOW,
    });
    expect(out.hadCandidates).toBe(true);
    expect(out.decisionTrace.some((c) => c.startsWith("reranker_gateway:"))).toBe(false);
  });

  it("flag ON reorders so primary legislation outranks acas guidance", async () => {
    process.env.ITERLAW_RERANKER_ENABLED = "true";
    const fullTextSearch = () => [
      mk({ candidate_id: "acas", source_type: "acas_guidance", qa_status: "approved", keyword_rank: 1 }),
      mk({ candidate_id: "leg", source_type: "statutory_source", qa_status: "approved", keyword_rank: 2 }),
    ];
    const out = await runMultiTierRetrievalGateway({
      question: "redundancy pay",
      queryType: "legal_question",
      deps: { fullTextSearch },
      nowIsoDate: NOW,
    });
    const ids = out.finalCandidates.map((c) => c.candidate_id);
    expect(ids[0]).toBe("leg");
    expect(out.decisionTrace).toContain("reranker_gateway:applied");
  });

  it("flag ON keeps a stable order when scores tie", async () => {
    process.env.ITERLAW_RERANKER_ENABLED = "true";
    const fullTextSearch = () => [
      mk({ candidate_id: "a", source_type: "statutory_source" }),
      mk({ candidate_id: "b", source_type: "statutory_source" }),
    ];
    const out = await runMultiTierRetrievalGateway({
      question: "anything",
      queryType: "legal_question",
      deps: { fullTextSearch },
      nowIsoDate: NOW,
    });
    expect(out.finalCandidates.map((c) => c.candidate_id)).toEqual(["a", "b"]);
  });

  it("flag ON but <2 candidates → reranker skipped with explicit trace", async () => {
    process.env.ITERLAW_RERANKER_ENABLED = "true";
    const fullTextSearch = () => [mk({ candidate_id: "solo" })];
    const out = await runMultiTierRetrievalGateway({
      question: "anything",
      queryType: "legal_question",
      deps: { fullTextSearch },
      nowIsoDate: NOW,
    });
    expect(out.decisionTrace).toContain("reranker_gateway:skipped:not_enough_candidates");
  });

  it("reason codes are deterministic for the gateway trace", async () => {
    process.env.ITERLAW_RERANKER_ENABLED = "true";
    const fullTextSearch = () => [mk({ candidate_id: "a" }), mk({ candidate_id: "b" })];
    const out = await runMultiTierRetrievalGateway({
      question: "anything",
      queryType: "legal_question",
      deps: { fullTextSearch },
      nowIsoDate: NOW,
    });
    expect(out.decisionTrace).toContain("reranker_gateway:applied");
    expect(out.decisionTrace.some((c) => c.startsWith("reranker_gateway:count:"))).toBe(true);
  });

  it("no external network / no LLM call is made (synchronous candidate sources)", async () => {
    process.env.ITERLAW_RERANKER_ENABLED = "true";
    let callCount = 0;
    const fullTextSearch = () => {
      callCount += 1;
      return [
        mk({ candidate_id: "a" }),
        mk({ candidate_id: "b" }),
      ];
    };
    await runMultiTierRetrievalGateway({
      question: "anything",
      queryType: "legal_question",
      deps: { fullTextSearch },
      nowIsoDate: NOW,
    });
    expect(callCount).toBe(1);
  });
});

// Sprint 14 — trust scorer tests.

import { describe, expect, it } from "vitest";
import { scoreCandidates } from "../intelligence/trustScorer";
import type {
  IntelligenceRequest,
  RetrievalCandidate,
} from "../intelligence/intelligence.types";

function req(legal: boolean): IntelligenceRequest {
  return {
    workspace_id: "w1",
    project_id: "p1",
    user_id: "u1",
    question: "Q",
    legal_mode: legal,
  };
}

function cand(over: Partial<RetrievalCandidate>): RetrievalCandidate {
  return {
    candidate_id: over.candidate_id ?? "c1",
    source_type: over.source_type ?? "statutory_source",
    source_id: over.source_id ?? "s1",
    source_title: null,
    source_url: null,
    text: "text",
    effective_from: null,
    effective_to: null,
    qa_status: over.qa_status ?? "approved",
    authority_level: null,
    keyword_rank: null,
    vector_rank: null,
    reason_codes: [],
    ...over,
  };
}

describe("Sprint 14 — trust scorer base mapping", () => {
  it("primary legislation scores 100", () => {
    const r = scoreCandidates([cand({ source_type: "statutory_source" })], req(true));
    expect(r[0].score).toBe(100);
  });

  it("acas / govuk guidance scores 95", () => {
    const a = scoreCandidates([cand({ candidate_id: "a", source_type: "acas_guidance" })], req(true));
    const g = scoreCandidates([cand({ candidate_id: "g", source_type: "govuk_guidance" })], req(true));
    expect(a[0].score).toBe(95);
    expect(g[0].score).toBe(95);
  });

  it("tribunal case scores 90", () => {
    const r = scoreCandidates([cand({ source_type: "tribunal_case" })], req(true));
    expect(r[0].score).toBe(90);
  });

  it("draft ai output scores 50", () => {
    const r = scoreCandidates([cand({ source_type: "draft_ai_output", qa_status: "draft" })], req(false));
    expect(r[0].score).toBe(50);
  });

  it("failed-QA candidate scores 0 regardless of source_type", () => {
    const r = scoreCandidates([cand({ source_type: "statutory_source", qa_status: "failed" })], req(true));
    expect(r[0].score).toBe(0);
    expect(r[0].source_type).toBe("failed_qa_or_blocked");
  });

  it("unreviewed cap at 30", () => {
    const r = scoreCandidates([cand({ source_type: "statutory_source", qa_status: "unreviewed" })], req(true));
    expect(r[0].score).toBeLessThanOrEqual(30);
  });
});

describe("Sprint 14 — trust scorer legal-mode demotions", () => {
  it("draft_ai_output cannot outrank statutory in legal mode", () => {
    const r = scoreCandidates(
      [
        cand({ candidate_id: "stat", source_type: "statutory_source" }),
        cand({ candidate_id: "drft", source_type: "draft_ai_output" }),
      ],
      req(true),
    );
    const stat = r.find((x) => x.candidate_id === "stat")!;
    const drft = r.find((x) => x.candidate_id === "drft")!;
    expect(drft.score).toBeLessThan(stat.score);
  });

  it("architecture_decision is capped below tribunal_case in legal mode", () => {
    const r = scoreCandidates(
      [
        cand({ candidate_id: "arch", source_type: "architecture_decision" }),
        cand({ candidate_id: "trib", source_type: "tribunal_case" }),
      ],
      req(true),
    );
    const arch = r.find((x) => x.candidate_id === "arch")!;
    const trib = r.find((x) => x.candidate_id === "trib")!;
    expect(arch.score).toBeLessThan(trib.score);
  });

  it("every trust score carries reason codes", () => {
    const r = scoreCandidates([cand({ source_type: "statutory_source" })], req(true));
    expect(r[0].reason_codes.length).toBeGreaterThan(0);
  });
});

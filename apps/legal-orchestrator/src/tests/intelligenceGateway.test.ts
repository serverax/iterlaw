// Sprint 14 Intelligence Layer — gateway integration tests (mock-safe).

import { describe, expect, it } from "vitest";
import { runIntelligenceGateway } from "../intelligence/intelligenceGateway";
import type {
  IntelligenceRequest,
  RetrievalCandidate,
} from "../intelligence/intelligence.types";

function baseRequest(over: Partial<IntelligenceRequest> = {}): IntelligenceRequest {
  return {
    workspace_id: "w1",
    project_id: "p1",
    user_id: "u1",
    question: "What is the limitation date for an unfair dismissal claim under ERA 1996?",
    legal_mode: true,
    legal_pack: "uk_employment_england_wales",
    facts: {},
    latest_event_at: "2026-05-13T00:00:00Z",
    ...over,
  };
}

function staturoryCandidate(over: Partial<RetrievalCandidate> = {}): RetrievalCandidate {
  return {
    candidate_id: "chunk_era_94",
    source_type: "statutory_source",
    source_id: "ERA-1996-s94",
    source_title: "Employment Rights Act 1996 s.94",
    source_url: "https://www.legislation.gov.uk/ukpga/1996/18/section/94",
    text: "An employee has the right not to be unfairly dismissed by his employer.",
    effective_from: "1996-08-22",
    effective_to: null,
    last_verified_at: "2026-05-01",
    qa_status: "approved",
    authority_level: 100,
    keyword_rank: 1,
    vector_rank: 1,
    reason_codes: ["seed_chunk"],
    ...over,
  };
}

describe("Sprint 14 — IntelligenceGateway happy path (legal mode)", () => {
  it("returns proceed when statutory evidence is fresh and high-trust", () => {
    const r = runIntelligenceGateway({
      request: baseRequest(),
      keyword_ranked: [staturoryCandidate()],
      vector_ranked: [staturoryCandidate()],
      model_used: "mock-uk-employment",
      answer_legal_claims: [
        { claim_id: "claim1", cited_source_ids: ["ERA-1996-s94"] },
      ],
    });
    expect(r.decision).toBe("proceed");
    expect(r.evidence.length).toBe(1);
    expect(r.evidence[0]?.source_type).toBe("statutory_source");
    expect(r.evidence[0]?.trust_score).toBeGreaterThanOrEqual(80);
    expect(r.trace.cache_key?.legal_mode).toBe(true);
  });

  it("returns insufficient_sources when no candidates given", () => {
    const r = runIntelligenceGateway({
      request: baseRequest(),
      keyword_ranked: [],
      vector_ranked: [],
    });
    expect(r.decision).toBe("insufficient_sources");
    expect(r.evidence).toEqual([]);
  });

  it("blocks when only stale legal source", () => {
    const stale = staturoryCandidate({
      effective_to: "2010-01-01",
    });
    const r = runIntelligenceGateway({
      request: baseRequest(),
      keyword_ranked: [stale],
      vector_ranked: [stale],
    });
    // stale legal sources are filtered out -> 0 evidence -> insufficient_sources
    expect(["block", "insufficient_sources"]).toContain(r.decision);
  });

  it("blocks when an answer claim is uncited", () => {
    const cand = staturoryCandidate();
    const r = runIntelligenceGateway({
      request: baseRequest(),
      keyword_ranked: [cand],
      vector_ranked: [cand],
      answer_legal_claims: [
        { claim_id: "claim1", cited_source_ids: ["NOT-IN-EVIDENCE"] },
      ],
    });
    expect(r.decision).toBe("block");
    expect(r.trace.evaluation.uncited_legal_claim_detected).toBe(true);
  });

  it("decision trace is non-empty and contains reason codes", () => {
    const r = runIntelligenceGateway({
      request: baseRequest(),
      keyword_ranked: [staturoryCandidate()],
      vector_ranked: [staturoryCandidate()],
    });
    expect(r.trace.reason_codes.length).toBeGreaterThan(0);
    expect(r.trace.intent).toBe("legal_question");
    expect(r.trace.plan.sources_priority.length).toBeGreaterThan(0);
  });

  it("non-legal-mode question (project status) returns proceed with project sources", () => {
    const r = runIntelligenceGateway({
      request: baseRequest({
        question: "What is the current sprint status of IterLaw?",
        legal_mode: false,
      }),
      keyword_ranked: [
        {
          candidate_id: "sprint_index_2026Q2",
          source_type: "sprint_report",
          source_id: "SPRINT_INDEX",
          source_title: "Sprint index",
          source_url: null,
          text: "Sprint 12 is PASS for dry-run foundation.",
          effective_from: "2026-05-13",
          effective_to: null,
          qa_status: "approved",
          authority_level: null,
          keyword_rank: 1,
          vector_rank: 1,
          reason_codes: [],
        },
      ],
      vector_ranked: [],
    });
    expect(r.decision).toBe("proceed");
    expect(r.trace.intent).toBe("project_status");
  });
});

describe("Sprint 14 — IntelligenceGateway never leaks DSN-like values", () => {
  it("no DSN/password/token in any trace or evidence text", () => {
    const r = runIntelligenceGateway({
      request: baseRequest(),
      keyword_ranked: [staturoryCandidate()],
      vector_ranked: [staturoryCandidate()],
    });
    const body = JSON.stringify(r);
    expect(body).not.toMatch(/postgres:\/\//);
    expect(body).not.toMatch(/postgresql:\/\//);
    expect(body).not.toMatch(/POSTGRES_PASSWORD/);
    expect(body).not.toMatch(/BORG_PASSPHRASE/);
    expect(body).not.toMatch(/\bsk-[A-Za-z0-9]{12,}/);
  });
});

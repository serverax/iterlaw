import { afterEach, describe, expect, it } from "vitest";

import { runMultiTierRetrievalGateway } from "../retrieval/multiTierRetrievalGateway";
import type { PgvectorClient, PgvectorRow } from "../retrieval/pgvectorSearchAdapter";
import { getPgvectorGatewayConfig } from "../config/featureFlags";
import type { RetrievalCandidate } from "../intelligence/intelligence.types";

const NOW = "2026-05-14";

function mkVectorCandidate(id: string): RetrievalCandidate {
  return {
    candidate_id: id,
    source_type: "statutory_source",
    source_id: `doc-${id}`,
    source_title: "Employment Rights Act 1996",
    source_url: "https://www.legislation.gov.uk/ukpga/1996/18/section/94",
    text: "An employee has the right not to be unfairly dismissed.",
    effective_from: "1996-05-22",
    effective_to: null,
    last_verified_at: "2026-01-01",
    superseded_by: null,
    qa_status: "approved",
    authority_level: 90,
    keyword_rank: null,
    vector_rank: null,
    reason_codes: [],
  };
}

function row(o: Partial<PgvectorRow> = {}): PgvectorRow {
  return {
    chunk_id: "vec-1",
    document_id: "doc-1",
    source_type: "legislation",
    chunk_text: "An employee has the right not to be unfairly dismissed.",
    title: "Employment Rights Act 1996",
    url: "https://www.legislation.gov.uk/ukpga/1996/18/section/94",
    authority_level: 90,
    effective_date: "1996-05-22",
    applicable_to: null,
    ...o,
  };
}

function makeClient(handler?: () => ReadonlyArray<PgvectorRow>): PgvectorClient {
  return {
    searchByEmbedding: async () => (handler ? handler() : [row()]),
  };
}

function makeEmbedder(returns: number[] = [0.1, 0.2, 0.3]) {
  return () => returns;
}

const prev = process.env.ITERLAW_PGVECTOR_GATEWAY_ENABLED;
afterEach(() => {
  if (prev !== undefined) process.env.ITERLAW_PGVECTOR_GATEWAY_ENABLED = prev;
  else delete process.env.ITERLAW_PGVECTOR_GATEWAY_ENABLED;
});

describe("ITERLAW_PGVECTOR_GATEWAY_ENABLED feature flag", () => {
  it("defaults to OFF when env var is unset", () => {
    delete process.env.ITERLAW_PGVECTOR_GATEWAY_ENABLED;
    expect(getPgvectorGatewayConfig().enabled).toBe(false);
  });

  it("parses canonical truthy / falsy values", () => {
    for (const v of ["true", "1", "yes", "on"]) {
      process.env.ITERLAW_PGVECTOR_GATEWAY_ENABLED = v;
      expect(getPgvectorGatewayConfig().enabled).toBe(true);
    }
    for (const v of ["false", "0", "", "anything"]) {
      process.env.ITERLAW_PGVECTOR_GATEWAY_ENABLED = v;
      expect(getPgvectorGatewayConfig().enabled).toBe(false);
    }
  });
});

describe("runMultiTierRetrievalGateway × pgvector flag", () => {
  it("flag OFF → no pgvector_gateway trace; legacy behaviour preserved", async () => {
    delete process.env.ITERLAW_PGVECTOR_GATEWAY_ENABLED;
    const out = await runMultiTierRetrievalGateway({
      question: "any",
      queryType: "legal_question",
      nowIsoDate: NOW,
    });
    expect(out.decisionTrace.some((c) => c.startsWith("pgvector_gateway:"))).toBe(false);
    expect(out.hadCandidates).toBe(false);
  });

  it("flag ON + no deps → records no_dependencies; behaviour unchanged", async () => {
    process.env.ITERLAW_PGVECTOR_GATEWAY_ENABLED = "true";
    const out = await runMultiTierRetrievalGateway({
      question: "any",
      queryType: "legal_question",
      nowIsoDate: NOW,
    });
    expect(out.decisionTrace).toContain("pgvector_gateway:no_dependencies");
    expect(out.hadCandidates).toBe(false);
  });

  it("flag ON + client + embedder + adapter success → vector tier produces candidates", async () => {
    process.env.ITERLAW_PGVECTOR_GATEWAY_ENABLED = "true";
    const out = await runMultiTierRetrievalGateway({
      question: "unfair dismissal",
      queryType: "legal_question",
      nowIsoDate: NOW,
      pgvector: { client: makeClient(), embedder: makeEmbedder() },
    });
    expect(out.decisionTrace).toContain("pgvector_gateway:wired");
    expect(out.hadCandidates).toBe(true);
    // The pgvector adapter mapped row -> RetrievalCandidate with reason code.
    expect(out.finalCandidates.some((c) => c.reason_codes.includes("postgres_full_text_adapter"))).toBe(false);
    expect(out.finalCandidates.length).toBeGreaterThan(0);
  });

  it("flag ON + caller already supplied vectorSearch → caller wins; trace shows skip", async () => {
    process.env.ITERLAW_PGVECTOR_GATEWAY_ENABLED = "true";
    const out = await runMultiTierRetrievalGateway({
      question: "anything",
      queryType: "legal_question",
      nowIsoDate: NOW,
      deps: {
        vectorSearch: () => [mkVectorCandidate("caller-supplied")],
      },
      pgvector: { client: makeClient(), embedder: makeEmbedder() },
    });
    expect(out.decisionTrace).toContain("pgvector_gateway:skipped:caller_supplied_vector_search");
    expect(out.finalCandidates.map((c) => c.candidate_id)).toContain("caller-supplied");
  });

  it("flag ON + client that errors → adapter swallows; safe fallback (no leak)", async () => {
    process.env.ITERLAW_PGVECTOR_GATEWAY_ENABLED = "true";
    const errorClient: PgvectorClient = {
      searchByEmbedding: async () => {
        throw new Error("postgres://user:password@host:5432/db connection failed");
      },
    };
    const out = await runMultiTierRetrievalGateway({
      question: "anything",
      queryType: "legal_question",
      nowIsoDate: NOW,
      pgvector: { client: errorClient, embedder: makeEmbedder() },
    });
    // Gateway still records "wired"; the adapter itself swallowed the error.
    expect(out.decisionTrace).toContain("pgvector_gateway:wired");
    // No leaked DSN in any reason code.
    for (const code of out.decisionTrace) {
      expect(code).not.toContain("postgres://");
      expect(code).not.toContain("password");
    }
  });
});

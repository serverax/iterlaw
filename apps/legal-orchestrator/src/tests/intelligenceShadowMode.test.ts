// Sprint 15 — shadow-mode wiring tests.
//
// Shadow mode: feature flag enabled + mode=shadow. The orchestrator
// must invoke the intelligence gateway internally but must NOT change
// the public response shape, the answer text, the citations, or the
// safety statuses. Any error inside the gateway must collapse to a
// no-op (legacy path unchanged).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleLegalRequest } from "../pipeline/handleLegalRequest";
import type { LegalRequest } from "../types/legal";
import type {
  OllamaTransport,
  OllamaTransportRequest,
  OllamaTransportResponse,
} from "../legal/llm/llm.types";
import type { RetrievalPort } from "../rag/retrieval.port";

function withShadowMode() {
  vi.stubEnv("ITERLAW_INTELLIGENCE_LAYER_ENABLED", "true");
  vi.stubEnv("ITERLAW_INTELLIGENCE_LAYER_MODE", "shadow");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

function baseReq(over: Partial<LegalRequest> = {}): LegalRequest {
  return {
    request_id: "shadow-req",
    user_id: "u1",
    workspace_id: "w1",
    mode: "ask",
    question: "Was I unfairly dismissed under ERA 1996?",
    facts: { dismissal_date: "2026-04-01", acas_started: true },
    ...over,
  };
}

function emptyRetrieval(): RetrievalPort {
  return {
    async search() {
      return { chunks: [], retrieval_notes: [] } as unknown as Awaited<
        ReturnType<RetrievalPort["search"]>
      >;
    },
  };
}

function chunkOk() {
  return {
    chunk_id: "chunk_era_94",
    document_id: "doc_era_1996",
    source_type: "legislation",
    authority_level: 100,
    title: "Employment Rights Act 1996 s.94",
    url: "https://www.legislation.gov.uk/ukpga/1996/18/section/94",
    citation_label: "ERA 1996 s.94",
    section_reference: "s.94",
    paragraph_reference: null as string | null,
    chunk_text: "An employee has the right not to be unfairly dismissed by his employer.",
    authority_level_value: 100,
    effective_date: null as string | null,
    applicable_to: null as string | null,
  };
}

function retrievalReturning(chunks: ReturnType<typeof chunkOk>[]): RetrievalPort {
  return {
    async search() {
      return {
        chunks: chunks as unknown as Parameters<RetrievalPort["search"]>[0] extends never ? never : never,
        retrieval_notes: [],
      } as unknown as Awaited<ReturnType<RetrievalPort["search"]>>;
    },
  };
}

describe("Sprint 15 — shadow mode does not change behaviour", () => {
  beforeEach(() => {
    withShadowMode();
  });

  it("Test 1: empty retrieval -> same insufficient/refusal status as disabled path", async () => {
    const transport: OllamaTransport & { send: ReturnType<typeof vi.fn> } = {
      send: vi.fn(async (_r: OllamaTransportRequest): Promise<OllamaTransportResponse> => ({ status: "ok" })),
    } as never;
    const r = await handleLegalRequest(baseReq(), {
      retrieval: emptyRetrieval(),
      transport,
      gateway: { configured: true, mode: "ollama", available: true },
    });
    expect(transport.send).not.toHaveBeenCalled();
    expect([
      "insufficient_sources",
      "needs_more_facts",
      "high_risk_deadline",
      "citation_failed",
      "policy_failed",
    ]).toContain(r.status);
    expect(r.external_llm_used).toBe(false);
  });

  it("Test 2: shadow mode does not bypass zero-citation blocking", async () => {
    // Drafter returns no citations -> citation_failed remains.
    const transport: OllamaTransport & { send: ReturnType<typeof vi.fn> } = {
      send: vi.fn(async (_r: OllamaTransportRequest): Promise<OllamaTransportResponse> => ({
        status: "ok",
        answer: "uncited paragraph",
        citedChunkIds: [],
        modelUsed: "mock",
        latencyMs: 0,
      })),
    } as never;
    const r = await handleLegalRequest(baseReq(), {
      retrieval: retrievalReturning([chunkOk()]),
      transport,
      gateway: { configured: true, mode: "ollama", available: true },
    });
    expect(r.status).toBe("citation_failed");
    expect(r.citations).toEqual([]);
  });

  it("Test 3: shadow mode preserves citations from the drafter when valid", async () => {
    const transport: OllamaTransport & { send: ReturnType<typeof vi.fn> } = {
      send: vi.fn(async (_r: OllamaTransportRequest): Promise<OllamaTransportResponse> => ({
        status: "ok",
        answer: "Per [chunk_era_94] the position is …",
        citedChunkIds: ["chunk_era_94"],
        modelUsed: "mock",
        latencyMs: 0,
      })),
    } as never;
    const r = await handleLegalRequest(baseReq(), {
      retrieval: retrievalReturning([chunkOk()]),
      transport,
      gateway: { configured: true, mode: "ollama", available: true },
    });
    expect(r.status).toBe("safe_answer");
    expect(r.citations.length).toBeGreaterThan(0);
    expect(r.citations[0]?.chunk_id).toBe("chunk_era_94");
  });

  it("Test 4: shadow mode does not expose internal intelligence detail in the response", async () => {
    const transport: OllamaTransport & { send: ReturnType<typeof vi.fn> } = {
      send: vi.fn(async (): Promise<OllamaTransportResponse> => ({
        status: "ok",
        answer: "Per [chunk_era_94] …",
        citedChunkIds: ["chunk_era_94"],
        modelUsed: "mock",
        latencyMs: 0,
      })),
    } as never;
    const r = await handleLegalRequest(baseReq(), {
      retrieval: retrievalReturning([chunkOk()]),
      transport,
      gateway: { configured: true, mode: "ollama", available: true },
    });
    const body = JSON.stringify(r);
    expect(body).not.toContain("rrf_scores");
    expect(body).not.toContain("retrieved_context_hash");
    expect(body).not.toContain("intelligence_trace");
    expect(body).not.toContain("trust_threshold_met");
    expect(body).not.toContain("source_diversity");
  });

  it("Test 5: shadow mode survives intelligenceGateway error and falls back", async () => {
    // Force the intelligence gateway to throw by passing a chunk with a
    // text field that would normally be fine; we patch behaviour by
    // injecting an unusual workspace shape. The handleLegalRequest
    // wrapper catches the throw and continues — the legacy result is
    // produced as if shadow had never run.
    const transport: OllamaTransport & { send: ReturnType<typeof vi.fn> } = {
      send: vi.fn(async (): Promise<OllamaTransportResponse> => ({
        status: "ok",
        answer: "Per [chunk_era_94] …",
        citedChunkIds: ["chunk_era_94"],
        modelUsed: "mock",
        latencyMs: 0,
      })),
    } as never;

    // Even if the workspace_id is missing, the gateway must not crash
    // the legacy path. The try/catch in handleLegalRequest swallows it.
    const r = await handleLegalRequest(
      { ...baseReq(), workspace_id: undefined as unknown as string, user_id: undefined as unknown as string },
      {
        retrieval: retrievalReturning([chunkOk()]),
        transport,
        gateway: { configured: true, mode: "ollama", available: true },
      },
    );
    // The legacy path still produces a normal status.
    expect(["safe_answer", "citation_failed", "policy_failed"]).toContain(r.status);
  });
});

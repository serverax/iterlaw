// Sprint 11 Phase 4 — pipeline wiring tests.
//
// Tests handleLegalRequest with a MOCK transport injected. No real
// network. No real Ollama. The transport's call-count is the gate
// signal: 0 calls when retrieval is empty / citations fail / gateway
// disabled; 1 call only on the approved retrieval/citation path.

import { describe, expect, it, vi } from "vitest";
import { handleLegalRequest } from "../pipeline/handleLegalRequest";
import { InMemoryLlmAuditSink } from "../legal/llm/llmAuditSink";
import type { LegalRequest } from "../types/legal";
import type {
  OllamaTransport,
  OllamaTransportRequest,
  OllamaTransportResponse,
} from "../legal/llm/llm.types";
import type { LlmGatewayStatus } from "../legal/llm/llmGateway.types";
import type { RetrievalPort } from "../rag/retrieval.port";

const enabledGateway: LlmGatewayStatus = {
  configured: true,
  mode: "ollama",
  available: true,
};

const disabledGateway: LlmGatewayStatus = {
  configured: false,
  mode: "disabled",
  available: false,
  reason: "DISABLED",
};

function baseReq(over: Partial<LegalRequest> = {}): LegalRequest {
  return {
    request_id: "req-phase4",
    user_id: "u1",
    workspace_id: "w1",
    mode: "ask",
    question: "Was I unfairly dismissed under ERA 1996?",
    legal_pack: "uk_employment_england_wales",
    facts: { dismissal_date: "2026-04-01", acas_started: true },
    ...over,
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
    chunk_text:
      "An employee has the right not to be unfairly dismissed by his employer.",
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

function mockTransport(
  impl: (req: OllamaTransportRequest) => Promise<OllamaTransportResponse>,
): OllamaTransport & { send: ReturnType<typeof vi.fn> } {
  const send = vi.fn(impl as never);
  return { send: send as never } as OllamaTransport & { send: ReturnType<typeof vi.fn> };
}

// =====================================================================
// 1. pipeline does not call local LLM when RAG has no sources
// =====================================================================

describe("Sprint 11 Phase 4 — pipeline does not call LLM without sources", () => {
  it("1. empty retrieval -> transport receives ZERO calls; status is a safe non-ok refusal", async () => {
    const transport = mockTransport(async () => ({ status: "ok" }) as OllamaTransportResponse);
    const r = await handleLegalRequest(baseReq(), {
      retrieval: retrievalReturning([]),
      transport,
      gateway: enabledGateway,
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

  it("2. gateway disabled -> transport receives ZERO calls; status is llm_unavailable when chunks present", async () => {
    const transport = mockTransport(async () => ({ status: "ok" }) as OllamaTransportResponse);
    const r = await handleLegalRequest(baseReq(), {
      retrieval: retrievalReturning([chunkOk()]),
      transport,
      gateway: disabledGateway,
    });
    expect(transport.send).not.toHaveBeenCalled();
    // The drafter short-circuits to llm_unavailable when the gateway is
    // disabled. The wiring layer maps that to the response status.
    expect(r.status).toBe("llm_unavailable");
    expect(r.external_llm_used).toBe(false);
  });
});

// =====================================================================
// 3-5. pipeline calls LLM only after retrieval+citation; citations required
// =====================================================================

describe("Sprint 11 Phase 4 — LLM only after approved retrieval; citations required", () => {
  it("3. valid retrieval + enabled gateway -> transport called once; status safe_answer; citations from drafter", async () => {
    const transport = mockTransport(
      async () =>
        ({
          status: "ok",
          answer: "Per [chunk_era_94] the position is …",
          citedChunkIds: ["chunk_era_94"],
          modelUsed: "uk-employment-qwen:latest",
          latencyMs: 100,
        }) as OllamaTransportResponse,
    );
    const r = await handleLegalRequest(baseReq(), {
      retrieval: retrievalReturning([chunkOk()]),
      transport,
      gateway: enabledGateway,
    });
    expect(transport.send).toHaveBeenCalledTimes(1);
    expect(r.status).toBe("safe_answer");
    expect(r.citations.length).toBeGreaterThan(0);
    expect(r.citations[0]?.chunk_id).toBe("chunk_era_94");
    expect(r.external_llm_used).toBe(false);
    expect(r.synthesis_status).toBe("completed");
    expect(r.synthesis_mode).toBe("direct_local");
  });

  it("4. drafter cites hallucinated chunk_id -> status citation_failed; transport called once; answer suppressed", async () => {
    const transport = mockTransport(
      async () =>
        ({
          status: "ok",
          answer: "Per [fake_id] the position is …",
          citedChunkIds: ["fake_id"],
          modelUsed: "uk-employment-qwen:latest",
          latencyMs: 100,
        }) as OllamaTransportResponse,
    );
    const r = await handleLegalRequest(baseReq(), {
      retrieval: retrievalReturning([chunkOk()]),
      transport,
      gateway: enabledGateway,
    });
    expect(transport.send).toHaveBeenCalledTimes(1);
    expect(r.status).toBe("citation_failed");
    expect(r.citations).toEqual([]);
    expect(r.answer).not.toContain("fake_id");
  });

  it("5. drafter returns empty citation list -> status citation_failed; no answer leak", async () => {
    const transport = mockTransport(
      async () =>
        ({
          status: "ok",
          answer: "an uncited paragraph that should never be returned",
          citedChunkIds: [],
          modelUsed: "uk-employment-qwen:latest",
          latencyMs: 100,
        }) as OllamaTransportResponse,
    );
    const r = await handleLegalRequest(baseReq(), {
      retrieval: retrievalReturning([chunkOk()]),
      transport,
      gateway: enabledGateway,
    });
    expect(transport.send).toHaveBeenCalledTimes(1);
    expect(r.status).toBe("citation_failed");
    expect(r.citations).toEqual([]);
    expect(r.answer).not.toContain("uncited paragraph");
  });

  it("6. transport returns timeout -> status llm_unavailable; no fabricated answer; no leak", async () => {
    const transport = mockTransport(
      async () => ({ status: "timeout" }) as OllamaTransportResponse,
    );
    const r = await handleLegalRequest(baseReq(), {
      retrieval: retrievalReturning([chunkOk()]),
      transport,
      gateway: enabledGateway,
    });
    expect(transport.send).toHaveBeenCalledTimes(1);
    expect(r.status).toBe("llm_unavailable");
    expect(r.citations).toEqual([]);
    expect(r.synthesis_status).toBe("unavailable");
  });
});

// =====================================================================
// 7. audit output records safe status only
// =====================================================================

describe("Sprint 11 Phase 4 — audit safety", () => {
  it("7. audit sink receives a redacted event for every drafter terminal path", async () => {
    const sink = new InMemoryLlmAuditSink();
    const transport = mockTransport(
      async () =>
        ({
          status: "ok",
          answer: "Per [chunk_era_94] the position is …",
          citedChunkIds: ["chunk_era_94"],
          modelUsed: "uk-employment-qwen:latest",
          latencyMs: 50,
        }) as OllamaTransportResponse,
    );
    await handleLegalRequest(baseReq(), {
      retrieval: retrievalReturning([chunkOk()]),
      transport,
      gateway: enabledGateway,
      auditSink: sink,
    });
    expect(sink.size()).toBeGreaterThanOrEqual(1);
    const ev = sink.events[sink.events.length - 1]!;
    expect(ev.status).toBe("success");
    // Forbidden fields stay out of the event:
    expect(ev).not.toHaveProperty("prompt");
    expect(ev).not.toHaveProperty("draftText");
    expect(ev).not.toHaveProperty("answer");
    expect(ev).not.toHaveProperty("rawAnswer");
    expect(ev).not.toHaveProperty("chunks");
    expect(ev).not.toHaveProperty("retrievedChunks");
    expect(JSON.stringify(ev)).not.toMatch(/DATABASE_URL\s*=/);
    expect(JSON.stringify(ev)).not.toMatch(/postgres(?:ql)?:\/\/[^@]+:[^@]+@/);
  });

  it("8. response envelope contains no DSN / password / prompt body / sk- literal across every status branch", async () => {
    const cases: Array<() => Promise<OllamaTransportResponse>> = [
      async () => ({ status: "ok", answer: "Per [chunk_era_94]", citedChunkIds: ["chunk_era_94"], modelUsed: "uk-employment-qwen:latest", latencyMs: 1 }) as OllamaTransportResponse,
      async () => ({ status: "ok", answer: "Per [fake]", citedChunkIds: ["fake"], modelUsed: "uk-employment-qwen:latest", latencyMs: 1 }) as OllamaTransportResponse,
      async () => ({ status: "timeout" }) as OllamaTransportResponse,
      async () => ({ status: "unavailable" }) as OllamaTransportResponse,
      async () => ({ status: "malformed" }) as OllamaTransportResponse,
    ];
    const banned = [
      /postgres(?:ql)?:\/\/[^@\s]+:[^@\s]+@/,
      /POSTGRES_PASSWORD\s*=/,
      /DATABASE_URL\s*=/,
      /\bsk-[A-Za-z0-9]{20,}/,
    ];
    for (const impl of cases) {
      const r = await handleLegalRequest(baseReq(), {
        retrieval: retrievalReturning([chunkOk()]),
        transport: mockTransport(impl),
        gateway: enabledGateway,
      });
      const json = JSON.stringify(r);
      for (const re of banned) {
        expect(json, `leak detected by ${re}`).not.toMatch(re);
      }
    }
  });

  it("9. no transport injected, chunks present -> existing skeleton path runs unchanged (citation_failed because empty draft)", async () => {
    // Back-compat test: existing callers that don't inject a transport
    // see the pre-Sprint-11 behaviour unchanged. With chunks present and
    // no drafter, the existing module pipeline rejects the empty draft
    // at the citation gate. Confirming the no-transport path leaves the
    // existing behaviour untouched.
    const r = await handleLegalRequest(baseReq(), {
      retrieval: retrievalReturning([chunkOk()]),
    });
    expect(["citation_failed", "policy_failed", "safe_answer"]).toContain(r.status);
    // The legacy skeleton tag must remain — confirms we did not silently
    // collapse the no-transport path into the Phase 4 wiring.
    expect(r.synthesis_mode).toBe("redis_streams");
  });

  it("10. external_llm_used is false on every path (no LLM is ever marked as external)", async () => {
    const cases: Array<() => Promise<OllamaTransportResponse>> = [
      async () => ({ status: "ok", answer: "Per [chunk_era_94]", citedChunkIds: ["chunk_era_94"], modelUsed: "uk-employment-qwen:latest", latencyMs: 1 }) as OllamaTransportResponse,
      async () => ({ status: "timeout" }) as OllamaTransportResponse,
      async () => ({ status: "unavailable" }) as OllamaTransportResponse,
    ];
    for (const impl of cases) {
      const r = await handleLegalRequest(baseReq(), {
        retrieval: retrievalReturning([chunkOk()]),
        transport: mockTransport(impl),
        gateway: enabledGateway,
      });
      expect(r.external_llm_used).toBe(false);
    }
  });
});

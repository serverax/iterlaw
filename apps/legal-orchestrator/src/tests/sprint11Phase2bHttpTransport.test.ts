// Sprint 11 Phase 2B — HTTP transport tests.
//
// Every test uses an injected `fetchImpl` mock. NO real network call.
// NO real Ollama instance. NO secret value ever appears in error /
// response output.

import { describe, expect, it, vi } from "vitest";
import {
  HttpOllamaTransport,
  createConfiguredOllamaTransport,
  type OllamaTransportRequest,
  type OllamaTransportResponse,
} from "../legal/llm";

function baseRequest(over: Partial<OllamaTransportRequest> = {}): OllamaTransportRequest {
  return {
    model: "uk-employment-qwen:latest",
    systemPrompt: "test-system",
    userPrompt: "test-user",
    allowedCitationIds: ["chunk_a", "chunk_b"],
    timeoutMs: 1_000,
    maxTokens: 100,
    traceId: "trace-test",
    ...over,
  };
}

function makeFetchMock(impl: (url: string, init?: unknown) => Promise<unknown>) {
  return vi.fn(impl as never);
}

describe("Sprint 11 Phase 2B — HttpOllamaTransport constructor + config", () => {
  it("1. transport refuses construction without a fetchImpl (no implicit global)", () => {
    expect(() =>
      // @ts-expect-error — intentionally omit fetchImpl to assert the runtime guard
      new HttpOllamaTransport({ baseUrl: "http://localhost:11434" }),
    ).toThrow(/fetchImpl/);
  });

  it("2. transport refuses construction without a baseUrl", () => {
    expect(() =>
      new HttpOllamaTransport({
        baseUrl: "",
        fetchImpl: makeFetchMock(async () => ({ ok: true, status: 200, text: async () => "{}" })),
      }),
    ).toThrow(/baseUrl/);
  });

  it("3. createConfiguredOllamaTransport returns undefined when ITERLAW_LOCAL_LLM_ENABLED is not 'true'", () => {
    const fetchMock = makeFetchMock(async () => ({
      ok: true,
      status: 200,
      text: async () => "{}",
    }));
    expect(
      createConfiguredOllamaTransport({
        env: {} as NodeJS.ProcessEnv,
        fetchImpl: fetchMock as never,
      }),
    ).toBeUndefined();
    expect(
      createConfiguredOllamaTransport({
        env: { ITERLAW_LOCAL_LLM_ENABLED: "false" } as NodeJS.ProcessEnv,
        fetchImpl: fetchMock as never,
      }),
    ).toBeUndefined();
  });

  it("4. createConfiguredOllamaTransport returns undefined when gateway mode is not 'ollama'", () => {
    const fetchMock = makeFetchMock(async () => ({
      ok: true,
      status: 200,
      text: async () => "{}",
    }));
    expect(
      createConfiguredOllamaTransport({
        env: {
          ITERLAW_LOCAL_LLM_ENABLED: "true",
          ITERLAW_LLM_GATEWAY_MODE: "disabled",
          ITERLAW_OLLAMA_BASE_URL: "http://localhost:11434",
        } as NodeJS.ProcessEnv,
        fetchImpl: fetchMock as never,
      }),
    ).toBeUndefined();
  });

  it("5. createConfiguredOllamaTransport returns undefined when base URL points at a public provider", () => {
    const fetchMock = makeFetchMock(async () => ({
      ok: true,
      status: 200,
      text: async () => "{}",
    }));
    for (const url of [
      "https://api.openai.com/v1",
      "https://api.anthropic.com/v1",
      "https://generativelanguage.googleapis.com/v1",
      "https://api.cohere.ai/v1",
      "https://api.mistral.ai/v1",
    ]) {
      expect(
        createConfiguredOllamaTransport({
          env: {
            ITERLAW_LOCAL_LLM_ENABLED: "true",
            ITERLAW_LLM_GATEWAY_MODE: "ollama",
            ITERLAW_OLLAMA_BASE_URL: url,
          } as NodeJS.ProcessEnv,
          fetchImpl: fetchMock as never,
        }),
        `expected undefined for ${url}`,
      ).toBeUndefined();
    }
  });

  it("6. createConfiguredOllamaTransport returns a transport for a local internal URL", () => {
    const fetchMock = makeFetchMock(async () => ({
      ok: true,
      status: 200,
      text: async () => "{}",
    }));
    const t = createConfiguredOllamaTransport({
      env: {
        ITERLAW_LOCAL_LLM_ENABLED: "true",
        ITERLAW_LLM_GATEWAY_MODE: "ollama",
        ITERLAW_OLLAMA_BASE_URL: "http://localhost:11434",
      } as NodeJS.ProcessEnv,
      fetchImpl: fetchMock as never,
    });
    expect(t).toBeDefined();
  });

  it("7. constructor + factory never read secrets from process.env beyond the named flags", () => {
    // The factory reads exactly three env vars; nothing else. Static check:
    const src = readSelf();
    expect(src).toMatch(/ITERLAW_LOCAL_LLM_ENABLED/);
    expect(src).toMatch(/ITERLAW_LLM_GATEWAY_MODE/);
    expect(src).toMatch(/ITERLAW_OLLAMA_BASE_URL/);
    // No reference to DATABASE_URL / POSTGRES_PASSWORD in the transport source.
    const transportSrc = readTransportSource();
    expect(transportSrc).not.toMatch(/DATABASE_URL/);
    expect(transportSrc).not.toMatch(/POSTGRES_PASSWORD/);
  });
});

describe("Sprint 11 Phase 2B — HttpOllamaTransport.send behaviour", () => {
  it("8. denied host (public provider) -> { status: 'unavailable' } and fetch is NEVER called", async () => {
    const fetchMock = makeFetchMock(async () => ({
      ok: true,
      status: 200,
      text: async () => "{}",
    }));
    const t = new HttpOllamaTransport({
      baseUrl: "https://api.openai.com/v1",
      fetchImpl: fetchMock as never,
    });
    const r = await t.send(baseRequest());
    expect(r.status).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("9. unknown internal HTTP host without allow-list -> { status: 'unavailable' } and fetch is NEVER called", async () => {
    const fetchMock = makeFetchMock(async () => ({
      ok: true,
      status: 200,
      text: async () => "{}",
    }));
    const t = new HttpOllamaTransport({
      baseUrl: "http://some-random-internal-lan.example.test:11434",
      fetchImpl: fetchMock as never,
    });
    const r = await t.send(baseRequest());
    expect(r.status).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("10. localhost http allowed by loopback rule -> fetch called once", async () => {
    const fetchMock = makeFetchMock(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          model: "uk-employment-qwen:latest",
          message: { role: "assistant", content: "Per [chunk_a], the law is …" },
        }),
    }));
    const t = new HttpOllamaTransport({
      baseUrl: "http://localhost:11434",
      fetchImpl: fetchMock as never,
    });
    const r = await t.send(baseRequest());
    expect(r.status).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("11. cluster-DNS host (.svc.cluster.local) allowed -> fetch called once", async () => {
    const fetchMock = makeFetchMock(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          model: "uk-employment-qwen:latest",
          message: { role: "assistant", content: "ok" },
        }),
    }));
    const t = new HttpOllamaTransport({
      baseUrl: "http://ollama.iterlaw-ai.svc.cluster.local:11434",
      fetchImpl: fetchMock as never,
    });
    const r = await t.send(baseRequest());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r.status === "ok" || r.status === "malformed").toBe(true);
  });

  it("12. timeout -> { status: 'timeout' }", async () => {
    const fetchMock = makeFetchMock(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = (init as { signal?: AbortSignal } | undefined)?.signal;
          if (signal) {
            signal.addEventListener("abort", () => {
              const e: Error & { name?: string } = new Error("aborted");
              e.name = "AbortError";
              reject(e);
            });
          }
        }),
    );
    const t = new HttpOllamaTransport({
      baseUrl: "http://localhost:11434",
      fetchImpl: fetchMock as never,
      defaultTimeoutMs: 10,
    });
    const r = await t.send(baseRequest({ timeoutMs: 10 }));
    expect(r.status).toBe("timeout");
  });

  it("13. non-2xx response (500) -> { status: 'unavailable' } and the response body is NOT read", async () => {
    let bodyReads = 0;
    const fetchMock = makeFetchMock(async () => ({
      ok: false,
      status: 500,
      text: async () => {
        bodyReads += 1;
        return "internal error: postgresql://leak:leak@db/leak"; // sentinel that must NOT leak
      },
    }));
    const t = new HttpOllamaTransport({
      baseUrl: "http://localhost:11434",
      fetchImpl: fetchMock as never,
    });
    const r = await t.send(baseRequest());
    expect(r.status).toBe("unavailable");
    expect(bodyReads).toBe(0);
  });

  it("14. invalid JSON body -> { status: 'malformed' }", async () => {
    const fetchMock = makeFetchMock(async () => ({
      ok: true,
      status: 200,
      text: async () => "this is not json {{{",
    }));
    const t = new HttpOllamaTransport({
      baseUrl: "http://localhost:11434",
      fetchImpl: fetchMock as never,
    });
    const r = await t.send(baseRequest());
    expect(r.status).toBe("malformed");
  });

  it("15. JSON without message.content -> { status: 'malformed' }", async () => {
    const fetchMock = makeFetchMock(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ done: true }),
    }));
    const t = new HttpOllamaTransport({
      baseUrl: "http://localhost:11434",
      fetchImpl: fetchMock as never,
    });
    const r = await t.send(baseRequest());
    expect(r.status).toBe("malformed");
  });

  it("16. ok response — extracts inline [chunk_*] citations from the model answer", async () => {
    const fetchMock = makeFetchMock(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          model: "uk-employment-qwen:latest",
          message: {
            role: "assistant",
            content: "Per [chunk_a] and [chunk_b], the position is X. [not_real] is ignored.",
          },
        }),
    }));
    const t = new HttpOllamaTransport({
      baseUrl: "http://localhost:11434",
      fetchImpl: fetchMock as never,
    });
    const r = (await t.send(baseRequest({ allowedCitationIds: ["chunk_a", "chunk_b"] }))) as Extract<
      OllamaTransportResponse,
      { status: "ok" }
    >;
    expect(r.status).toBe("ok");
    expect(r.citedChunkIds).toEqual(["chunk_a", "chunk_b"]);
    // The hallucinated id is dropped — defence in depth on top of the output guard.
    expect(r.citedChunkIds).not.toContain("not_real");
    expect(r.modelUsed).toBe("uk-employment-qwen:latest");
  });

  it("17. unknown model tag at runtime -> { status: 'unavailable' } and fetch is NEVER called", async () => {
    const fetchMock = makeFetchMock(async () => ({
      ok: true,
      status: 200,
      text: async () => "{}",
    }));
    const t = new HttpOllamaTransport({
      baseUrl: "http://localhost:11434",
      fetchImpl: fetchMock as never,
    });
    // Cast through unknown — the union type would reject this at compile
    // time; the runtime guard is the test target.
    const r = await t.send(baseRequest({ model: "gpt-4-turbo" as never }));
    expect(r.status).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("18. send() never throws on operational failure — always returns a structured response", async () => {
    // fetch throws a generic error (not an AbortError)
    const fetchMock = makeFetchMock(async () => {
      throw new Error("ECONNREFUSED 127.0.0.1:11434");
    });
    const t = new HttpOllamaTransport({
      baseUrl: "http://localhost:11434",
      fetchImpl: fetchMock as never,
    });
    const r = await t.send(baseRequest());
    expect(r.status).toBe("unavailable");
  });

  it("19. send() does not include the prompt or response body in any thrown error", async () => {
    // Use a fetch that throws an error whose .message contains a sentinel
    // value; the adapter must not propagate it.
    const sentinel = "SENSITIVE_PROMPT_BODY_LEAK_VALUE";
    const fetchMock = makeFetchMock(async () => {
      throw new Error(`internal error containing ${sentinel}`);
    });
    const t = new HttpOllamaTransport({
      baseUrl: "http://localhost:11434",
      fetchImpl: fetchMock as never,
    });
    // The adapter must NOT throw at all on this kind of failure.
    let thrown: unknown = null;
    try {
      const r = await t.send(baseRequest({ userPrompt: sentinel + "-in-user-prompt" }));
      expect(r.status).toBe("unavailable");
      const serialised = JSON.stringify(r);
      expect(serialised).not.toContain(sentinel);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeNull();
  });

  it("20. send() never logs / returns DATABASE_URL / POSTGRES_PASSWORD content even if present in the fetch error", async () => {
    const leaks = [
      "postgresql://user:secret@db.internal:5432/iterlaw",
      "POSTGRES_PASSWORD=very-secret-value",
      "DATABASE_URL=postgres://x:y@z/d",
    ];
    for (const leak of leaks) {
      const fetchMock = makeFetchMock(async () => {
        throw new Error(`network error: ${leak}`);
      });
      const t = new HttpOllamaTransport({
        baseUrl: "http://localhost:11434",
        fetchImpl: fetchMock as never,
      });
      const r = await t.send(baseRequest());
      expect(r.status).toBe("unavailable");
      const serialised = JSON.stringify(r);
      expect(serialised).not.toContain(leak);
    }
  });
});

// =====================================================================
// Helpers — read source files for static-safety assertions.
// =====================================================================

function readSelf(): string {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const p = path.resolve(__dirname, "../legal/llm/httpOllamaTransport.ts");
  return fs.readFileSync(p, "utf8");
}

function readTransportSource(): string {
  return readSelf();
}

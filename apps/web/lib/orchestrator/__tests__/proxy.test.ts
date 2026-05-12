/**
 * @jest-environment node
 */
import {
  orchestratorBase,
  forwardToOrchestrator,
  forwardFailureMessage,
} from "@/lib/orchestrator/proxy";

const ORIGINAL_FETCH = global.fetch;

describe("orchestratorBase()", () => {
  const ENV_KEYS = ["AI_ORCHESTRATOR_URL", "NEXT_PUBLIC_API_BASE_URL"] as const;
  const SAVED: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      SAVED[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (SAVED[k] === undefined) delete process.env[k];
      else process.env[k] = SAVED[k];
    }
  });

  it("defaults to http://127.0.0.1:3001 when no env is set", () => {
    expect(orchestratorBase()).toBe("http://127.0.0.1:3001");
  });

  it("prefers AI_ORCHESTRATOR_URL over NEXT_PUBLIC_API_BASE_URL", () => {
    process.env.AI_ORCHESTRATOR_URL = "http://primary.local:9001";
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://fallback.local:9002";
    expect(orchestratorBase()).toBe("http://primary.local:9001");
  });

  it("falls back to NEXT_PUBLIC_API_BASE_URL when AI_ORCHESTRATOR_URL is empty", () => {
    process.env.AI_ORCHESTRATOR_URL = "   ";
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://fallback.local:9002";
    expect(orchestratorBase()).toBe("http://fallback.local:9002");
  });

  it("strips trailing slashes", () => {
    process.env.AI_ORCHESTRATOR_URL = "http://primary.local:9001/";
    expect(orchestratorBase()).toBe("http://primary.local:9001");
  });
});

describe("forwardToOrchestrator()", () => {
  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it("returns { ok: true, body } on a 200 JSON response", async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ status: "ready" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as unknown as typeof fetch;

    const result = await forwardToOrchestrator({
      path: "/ready",
      method: "GET",
      timeoutMs: 1000,
    });
    expect(result).toEqual({ ok: true, status: 200, body: { status: "ready" } });
  });

  it("returns ok:false / status:502 / reason:upstream_error on 4xx", async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ error: "x" }), { status: 400 }),
    ) as unknown as typeof fetch;
    const result = await forwardToOrchestrator({
      path: "/api/legal/ask",
      method: "POST",
      body: { mode: "ask" },
      timeoutMs: 1000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.reason).toBe("upstream_error");
    }
  });

  it("returns ok:false / reason:timeout when fetch aborts with TimeoutError", async () => {
    global.fetch = jest.fn(async () => {
      const err = new Error("aborted");
      err.name = "TimeoutError";
      throw err;
    }) as unknown as typeof fetch;
    const result = await forwardToOrchestrator({
      path: "/ready",
      method: "GET",
      timeoutMs: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(504);
      expect(result.reason).toBe("timeout");
    }
  });

  it("returns ok:false / reason:unreachable on generic fetch failure", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const result = await forwardToOrchestrator({
      path: "/ready",
      method: "GET",
      timeoutMs: 1000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(502);
      expect(result.reason).toBe("unreachable");
    }
  });

  it("returns ok:false / reason:invalid_upstream_response when JSON parsing fails", async () => {
    global.fetch = jest.fn(async () =>
      new Response("<html>not json</html>", { status: 200 }),
    ) as unknown as typeof fetch;
    const result = await forwardToOrchestrator({
      path: "/ready",
      method: "GET",
      timeoutMs: 1000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_upstream_response");
    }
  });

  it("forwards the body as JSON for POST", async () => {
    const captured: { body?: string } = {};
    global.fetch = jest.fn(async (_url, init?: RequestInit) => {
      captured.body =
        typeof init?.body === "string" ? init.body : undefined;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;

    await forwardToOrchestrator({
      path: "/api/legal/ask",
      method: "POST",
      body: { question: "Q1", mode: "ask" },
      timeoutMs: 1000,
    });
    expect(captured.body).toBe('{"question":"Q1","mode":"ask"}');
  });

  it("sends no body on GET", async () => {
    const captured: { body?: unknown } = {};
    global.fetch = jest.fn(async (_url, init?: RequestInit) => {
      captured.body = init?.body;
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;

    await forwardToOrchestrator({ path: "/ready", method: "GET", timeoutMs: 1000 });
    expect(captured.body).toBeUndefined();
  });
});

describe("forwardFailureMessage()", () => {
  it("emits stable identifiers for every failure reason", () => {
    expect(forwardFailureMessage("timeout")).toBe("orchestrator_timeout");
    expect(forwardFailureMessage("unreachable")).toBe("orchestrator_unreachable");
    expect(forwardFailureMessage("invalid_upstream_response")).toBe(
      "orchestrator_invalid_response",
    );
    expect(forwardFailureMessage("upstream_error")).toBe(
      "orchestrator_rejected_request",
    );
  });
});

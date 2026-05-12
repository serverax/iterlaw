/**
 * @jest-environment node
 */

// next/headers cookies() relies on Next request context — mock it.
const cookieStore = new Map<string, string>();
jest.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined,
  }),
}));

import { POST as askPOST } from "@/app/api/orchestrator/legal/ask/route";
import { GET as readyGET } from "@/app/api/orchestrator/ready/route";

const ORIGINAL_FETCH = global.fetch;

function makeReq(body: unknown): import("next/server").NextRequest {
  return new Request("http://local/api/orchestrator/legal/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/orchestrator/legal/ask", () => {
  beforeEach(() => {
    cookieStore.clear();
  });
  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it("returns 400 invalid_json_body for non-JSON input", async () => {
    const req = new Request("http://local/api/orchestrator/legal/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    }) as unknown as import("next/server").NextRequest;
    const res = await askPOST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ error: "invalid_json_body" });
  });

  it("returns 400 invalid_request when body fails schema validation", async () => {
    const res = await askPOST(makeReq({ mode: "unknown_mode" }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("invalid_request");
  });

  it("rejects client-supplied identity fields (strict schema)", async () => {
    const res = await askPOST(
      makeReq({
        mode: "ask",
        question: "Q",
        user_id: "u-EVIL",
        request_id: "r-EVIL",
        workspace_id: "w-EVIL",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("forwards a valid POST to legal-orchestrator with server-stamped identity", async () => {
    const captured: { url?: string; body?: string } = {};
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      captured.url = url;
      captured.body = typeof init?.body === "string" ? init.body : undefined;
      return new Response(
        JSON.stringify({ status: "insufficient_sources", citations: [] }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const res = await askPOST(makeReq({ mode: "ask", question: "Q1" }));
    expect(res.status).toBe(200);
    expect(captured.url).toMatch(/\/api\/legal\/ask$/);
    const sent = JSON.parse(captured.body ?? "{}");
    expect(sent.question).toBe("Q1");
    expect(sent.mode).toBe("ask");
    // Server stamped these — never trusted from client.
    expect(typeof sent.request_id).toBe("string");
    expect(typeof sent.user_id).toBe("string");
    expect(typeof sent.workspace_id).toBe("string");
    expect(sent.user_id.startsWith("anon:")).toBe(true);
  });

  it("uses the iterlaw_anon_sid cookie when present", async () => {
    cookieStore.set("iterlaw_anon_sid", "test-sid-123");
    const captured: { body?: string } = {};
    global.fetch = jest.fn(async (_url, init?: RequestInit) => {
      captured.body = typeof init?.body === "string" ? init.body : undefined;
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;

    await askPOST(makeReq({ mode: "ask", question: "Q1" }));
    const sent = JSON.parse(captured.body ?? "{}");
    expect(sent.user_id).toBe("anon:test-sid-123");
    expect(sent.workspace_id).toBe("anon:test-sid-123");
  });

  it("returns 502 with sanitised body when orchestrator is unreachable", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("ECONNREFUSED 127.0.0.1:3001");
    }) as unknown as typeof fetch;
    const res = await askPOST(makeReq({ mode: "ask", question: "Q1" }));
    expect(res.status).toBe(502);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("orchestrator_unreachable");
    // The orchestrator URL/host must never leak in the body.
    expect(JSON.stringify(json)).not.toContain("127.0.0.1");
    expect(JSON.stringify(json)).not.toContain("3001");
    expect(JSON.stringify(json)).not.toContain("ECONNREFUSED");
  });

  it("returns 504 on upstream timeout", async () => {
    global.fetch = jest.fn(async () => {
      const err = new Error("aborted");
      err.name = "TimeoutError";
      throw err;
    }) as unknown as typeof fetch;
    const res = await askPOST(makeReq({ mode: "ask", question: "Q1" }));
    expect(res.status).toBe(504);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("orchestrator_timeout");
  });
});

describe("GET /api/orchestrator/ready", () => {
  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it("passes through the orchestrator's /ready body on success", async () => {
    const payload = {
      status: "ready",
      service: "legal-orchestrator",
      synthesis: { configured: false, reachable: false, queue: null, last_seen_at: null },
    };
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify(payload), { status: 200 }),
    ) as unknown as typeof fetch;

    const res = await readyGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(payload);
  });

  it("returns 503 with no host leak when orchestrator is unreachable", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("ECONNREFUSED secret-host.internal:9999");
    }) as unknown as typeof fetch;
    const res = await readyGET();
    expect(res.status).toBe(503);
    const json = (await res.json()) as { status: string; error: string };
    expect(json.status).toBe("unavailable");
    expect(json.error).toBe("orchestrator_unreachable");
    expect(JSON.stringify(json)).not.toContain("secret-host");
    expect(JSON.stringify(json)).not.toContain("ECONNREFUSED");
  });
});

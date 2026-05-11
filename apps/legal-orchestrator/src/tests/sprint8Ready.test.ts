// Sprint 8 acceptance tests:
//   - /ready envelope shape (mock + postgres modes)
//   - createApp() retrieval injection actually reaches handleLegalRequest
//   - DATABASE_URL never leaks into /ready output
//   - sentinel-credentials test: presence-only signalling
//
// All tests run with stubbed env to avoid relying on the host's DATABASE_URL.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../server";
import type { RagService } from "../rag/rag.service";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Sprint 8 — /ready envelope", () => {
  it("returns mock mode when DATABASE_URL is empty string", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const app = createApp();
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: "ready",
      service: "legal-orchestrator",
      rag: {
        configured: false,
        mode: "mock",
        database: "not_configured",
      },
      llm: { external_llm_enabled: false },
      legal_safety: {
        citation_required: true,
        zero_citation_answer_blocked: true,
      },
    });
  });

  it("returns postgres mode when DATABASE_URL is set, WITHOUT leaking the value", async () => {
    const sentinel =
      "postgres://SECRET_user:SECRET_pw@SECRET_host.example.invalid:5432/SECRET_db";
    vi.stubEnv("DATABASE_URL", sentinel);
    const app = createApp();
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body.rag).toEqual({
      configured: true,
      mode: "postgres",
      database: "configured",
    });
    expect(res.body.llm.external_llm_enabled).toBe(false);
    expect(res.body.legal_safety.citation_required).toBe(true);

    // Critical: NONE of the connection-string components must appear anywhere
    // in the response body.
    const text = JSON.stringify(res.body);
    expect(text).not.toContain("SECRET_user");
    expect(text).not.toContain("SECRET_pw");
    expect(text).not.toContain("SECRET_host");
    expect(text).not.toContain("SECRET_db");
    expect(text).not.toContain("postgres://");
    expect(text).not.toContain(sentinel);
  });
});

describe("Sprint 8 — createApp injects retrieval into handleLegalRequest", () => {
  let app: Express;
  let searchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "");
    searchSpy = vi.fn(async () => ({
      chunks: [],
      retrieval_notes: ["sprint8_test_injected_port"],
    }));
    const stubService: RagService = {
      search: searchSpy,
      describe: () => ({ strategy: "explicit_port", live: true }),
    };
    app = createApp({ ragService: stubService });
  });

  it("forwards POST /api/legal/ask through the injected RagService", async () => {
    const res = await request(app)
      .post("/api/legal/ask")
      .send({
        request_id: "sprint8-inj-1",
        user_id: "u",
        workspace_id: "w",
        mode: "ask",
        question: "Can my employer suspend me without telling me why?",
        facts: { suspension_date: "2026-05-01" },
      });
    expect(res.status).toBe(200);
    // Stub port returned no chunks -> insufficient_sources.
    expect(res.body.status).toBe("insufficient_sources");
    expect(res.body.external_llm_used).toBe(false);
    expect(res.body.citations).toEqual([]);

    // Proof of injection: our spy must have been called by handleLegalRequest.
    expect(searchSpy).toHaveBeenCalledTimes(1);
    const call = searchSpy.mock.calls[0]?.[0] as {
      query_text: string;
      legal_pack: string;
      jurisdiction?: string;
      limit: number;
    };
    expect(call.query_text).toBe(
      "Can my employer suspend me without telling me why?"
    );
    expect(call.legal_pack).toBe("uk_employment_england_wales");
    expect(typeof call.limit).toBe("number");

    // The injected port's retrieval_notes must surface in next_steps
    // (proves the whole pipeline ran end-to-end).
    expect(
      res.body.next_steps.some((s: string) =>
        s.includes("sprint8_test_injected_port")
      )
    ).toBe(true);
  });
});

describe("Sprint 8 — safety behaviour preserved under default wiring", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "");
  });

  it("POST /api/legal/ask returns insufficient_sources with default mock retrieval", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/legal/ask")
      .send({
        request_id: "sprint8-def-1",
        user_id: "u",
        workspace_id: "w",
        mode: "ask",
        question: "Can my employer suspend me without telling me why?",
        facts: { suspension_date: "2026-05-01" },
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("insufficient_sources");
    expect(res.body.external_llm_used).toBe(false);
    expect(res.body.citations).toEqual([]);
  });

  it("malformed JSON still returns 400 invalid_json_body, no stack trace", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/legal/ask")
      .set("Content-Type", "application/json")
      .send("not-json-at-all");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "invalid_json_body" });
    const txt = JSON.stringify(res.body);
    expect(txt).not.toMatch(/Error:/);
    expect(txt).not.toMatch(/at \w+\s*\(/);
    expect(txt).not.toMatch(/node_modules/);
  });

  it("/health remains a simple ok envelope", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

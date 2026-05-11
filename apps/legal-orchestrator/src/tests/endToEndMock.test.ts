import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../server";

describe("/api/legal/ask end-to-end (skeleton)", () => {
  let app: Express;

  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "");
    app = createApp();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects malformed request with 400", async () => {
    const res = await request(app).post("/api/legal/ask").send({});
    expect(res.status).toBe(400);
  });

  it("returns needs_more_facts for unfair-dismissal question with no dates", async () => {
    const res = await request(app)
      .post("/api/legal/ask")
      .send({
        request_id: "r1",
        user_id: "u1",
        workspace_id: "w1",
        mode: "ask",
        question: "Can I claim unfair dismissal?",
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("needs_more_facts");
    expect(res.body.missing_facts).toContain("dismissal_date");
    expect(res.body.citations).toEqual([]);
  });

  it("returns insufficient_sources for suspension question with all facts (no RAG data)", async () => {
    const res = await request(app)
      .post("/api/legal/ask")
      .send({
        request_id: "r2",
        user_id: "u1",
        workspace_id: "w1",
        mode: "ask",
        question: "Can my employer suspend me without telling me why?",
        facts: { suspension_date: "2026-05-01" },
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("insufficient_sources");
    expect(res.body.citations).toEqual([]);
    expect(res.body.external_llm_used).toBe(false);
  });

  it("/health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("/ready returns safe RAG + legal_safety envelope", async () => {
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
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

  it("does not leak a stack trace when body is unparseable JSON", async () => {
    const res = await request(app)
      .post("/api/legal/ask")
      .set("Content-Type", "application/json")
      .send("not-json-at-all");
    expect(res.status).toBe(400);
    // Must be a JSON error envelope, NOT HTML.
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: "invalid_json_body" });
    // Ensure no filesystem paths or "Error:" stack-trace markers leak.
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/Error:/);
    expect(text).not.toMatch(/at \w+\s*\(/);
    expect(text).not.toMatch(/[A-Z]:\\Users/);
    expect(text).not.toMatch(/node_modules/);
  });
});

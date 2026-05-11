import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp, ragReadyFromDescribe } from "../server";
import { createRagService } from "../rag/rag.service";

describe("createApp — default retrieval wiring", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps RagService describe() to safe /ready rag fields (mock vs postgres)", () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(ragReadyFromDescribe(createRagService().describe())).toEqual({
      configured: false,
      mode: "mock",
      database: "not_configured",
    });
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@host:5432/db");
    expect(ragReadyFromDescribe(createRagService().describe())).toEqual({
      configured: true,
      mode: "postgres",
      database: "configured",
    });
  });

  it("/ready reports rag.configured=false when DATABASE_URL is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const app = createApp();
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body.rag).toEqual({
      configured: false,
      mode: "mock",
      database: "not_configured",
    });
  });

  it("/ready does not leak DATABASE_URL when DATABASE_URL is set", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://fakeuser:ENTROPY_SECRET_VALUE_999@db.internal.example.com:5432/legaldb"
    );
    const app = createApp();
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain("ENTROPY_SECRET_VALUE_999");
    expect(raw).not.toContain("fakeuser");
    expect(raw).not.toContain("db.internal.example.com");
    expect(raw).not.toContain("postgresql://");
    expect(raw).not.toContain("5432");
    expect(res.body.rag).toEqual({
      configured: true,
      mode: "postgres",
      database: "configured",
    });
  });

  it("POST /api/legal/ask returns insufficient_sources when retrieval returns no chunks", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const app = createApp();
    const res = await request(app)
      .post("/api/legal/ask")
      .send({
        request_id: "r-rag-empty",
        user_id: "u1",
        workspace_id: "w1",
        mode: "ask",
        question: "Can my employer suspend me without telling me why?",
        facts: { suspension_date: "2026-05-01" },
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("insufficient_sources");
    expect(res.body.external_llm_used).toBe(false);
    expect(res.body.citations).toEqual([]);
    const notes = (res.body.next_steps as string[]).filter((s) => s.startsWith("retrieval:"));
    expect(notes.some((n) => n.includes("rag_service:empty_mock_default"))).toBe(true);
  });
});

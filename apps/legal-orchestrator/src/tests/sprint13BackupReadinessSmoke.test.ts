// Sprint 13 — backup readiness smoke tests.
//
// Goal: prove that the Sprint 12/13 backup changes did not perturb the
// legal-orchestrator /ready envelope or the handleLegalRequest mock-RAG
// refusal behaviour. No real DB. No real network. No real LLM. No
// backup env var leaks into any orchestrator response.

import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../server";
import { handleLegalRequest } from "../pipeline/handleLegalRequest";
import type { LegalRequest } from "../types/legal";
import type {
  OllamaTransport,
  OllamaTransportRequest,
  OllamaTransportResponse,
} from "../legal/llm/llm.types";
import type { RetrievalPort } from "../rag/retrieval.port";

afterEach(() => {
  vi.unstubAllEnvs();
});

function baseReq(over: Partial<LegalRequest> = {}): LegalRequest {
  return {
    request_id: "sprint13-req",
    user_id: "u1",
    workspace_id: "w1",
    mode: "ask",
    question: "Was I unfairly dismissed under ERA 1996?",
    legal_pack: "uk_employment_england_wales",
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

function recordingTransport(): OllamaTransport & {
  send: ReturnType<typeof vi.fn>;
} {
  const send = vi.fn(
    async (_req: OllamaTransportRequest): Promise<OllamaTransportResponse> => ({
      status: "ok",
      answer: "this transport should never be reached in these tests",
      citedChunkIds: [],
      modelUsed: "mock-not-reached",
      latencyMs: 0,
    }),
  );
  return { send: send as never } as OllamaTransport & {
    send: ReturnType<typeof vi.fn>;
  };
}

const BACKUP_ENV_NAMES = [
  "ITERLAW_BACKUP_DATABASE_URL",
  "ITERLAW_RESTORE_DATABASE_URL",
  "BORG_PASSPHRASE",
  "BORG_REPO",
  "SSH_PRIVATE_KEY",
  "POSTGRES_PASSWORD",
  "PGPASSWORD",
] as const;

const DSN_LIKE_PATTERNS = [
  /postgres:\/\//i,
  /postgresql:\/\//i,
  /password\s*=\s*[^\s,"']+/i,
  /\bsk-[A-Za-z0-9]{12,}/,
];

describe("Sprint 13 — /ready envelope unaffected by backup changes", () => {
  it("envelope shape preserved when DATABASE_URL is empty", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const app = createApp();
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
      llm: {
        external_llm_enabled: false,
      },
      legal_safety: {
        citation_required: true,
        zero_citation_answer_blocked: true,
      },
    });
  });

  it("/ready does not contain any backup env-var name in the response body", async () => {
    vi.stubEnv("DATABASE_URL", "");
    // Pollute the process env with the backup env names set to a sentinel,
    // then ensure the orchestrator does NOT propagate them into /ready.
    for (const name of BACKUP_ENV_NAMES) {
      vi.stubEnv(name, "SENTINEL_DO_NOT_LEAK_VALUE");
    }
    const app = createApp();
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("SENTINEL_DO_NOT_LEAK_VALUE");
    for (const name of BACKUP_ENV_NAMES) {
      expect(body, `expected ${name} not in /ready body`).not.toContain(name);
    }
  });

  it("/ready does not contain any DSN-like value even with sentinel DATABASE_URL", async () => {
    const sentinel =
      "postgresql://SECRET_user:SECRET_pw@SECRET_host.example.invalid:5432/SECRET_db";
    vi.stubEnv("DATABASE_URL", sentinel);
    const app = createApp();
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("SECRET_user");
    expect(body).not.toContain("SECRET_pw");
    expect(body).not.toContain("SECRET_host.example.invalid");
    for (const re of DSN_LIKE_PATTERNS) {
      expect(body, `expected no DSN-like pattern ${re} in /ready body`).not.toMatch(re);
    }
  });

  it("legal_safety.citation_required + zero_citation_answer_blocked remain true", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const app = createApp();
    const res = await request(app).get("/ready");
    expect(res.body.legal_safety.citation_required).toBe(true);
    expect(res.body.legal_safety.zero_citation_answer_blocked).toBe(true);
  });

  it("llm.external_llm_enabled remains false", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const app = createApp();
    const res = await request(app).get("/ready");
    expect(res.body.llm.external_llm_enabled).toBe(false);
  });
});

describe("Sprint 13 — handleLegalRequest mock smoke (no RAG, no LLM)", () => {
  it("empty retrieval + mock transport -> refusal status; transport NEVER called", async () => {
    const transport = recordingTransport();
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

  it("response envelope contains no DSN-like value", async () => {
    const transport = recordingTransport();
    const r = await handleLegalRequest(baseReq(), {
      retrieval: emptyRetrieval(),
      transport,
      gateway: { configured: true, mode: "ollama", available: true },
    });
    const body = JSON.stringify(r);
    for (const re of DSN_LIKE_PATTERNS) {
      expect(body, `expected no DSN-like pattern ${re} in response`).not.toMatch(re);
    }
    for (const name of BACKUP_ENV_NAMES) {
      expect(body, `expected ${name} not in response body`).not.toContain(name);
    }
  });

  it("no transport invoked even when called repeatedly with empty retrieval", async () => {
    const transport = recordingTransport();
    for (let i = 0; i < 3; i += 1) {
      await handleLegalRequest(baseReq({ request_id: `r-${i}` }), {
        retrieval: emptyRetrieval(),
        transport,
        gateway: { configured: true, mode: "ollama", available: true },
      });
    }
    expect(transport.send).not.toHaveBeenCalled();
  });
});

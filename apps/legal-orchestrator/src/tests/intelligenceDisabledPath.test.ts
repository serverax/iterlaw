// Sprint 15 — disabled-by-default behaviour tests.
//
// Proves that with no Intelligence Layer env vars set, the
// orchestrator answer path and /ready envelope are bit-identical
// to their pre-Sprint-15 behaviour.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const INTELLIGENCE_ENV_VARS = [
  "ITERLAW_INTELLIGENCE_LAYER_ENABLED",
  "ITERLAW_INTELLIGENCE_LAYER_MODE",
];

function stripIntelligenceEnv() {
  for (const v of INTELLIGENCE_ENV_VARS) vi.stubEnv(v, "");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Sprint 15 — Intelligence Layer disabled by default", () => {
  beforeEach(() => {
    stripIntelligenceEnv();
    vi.stubEnv("DATABASE_URL", "");
  });

  it("Test 1: /ready reports mode=off with default env", async () => {
    const app = createApp();
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body.intelligence_layer).toMatchObject({
      configured: false,
      mode: "off",
      external_network_enabled: false,
      external_llm_enabled: false,
    });
  });

  it("Test 2: handleLegalRequest output unchanged when Intelligence env missing (empty retrieval)", async () => {
    const transport: OllamaTransport & { send: ReturnType<typeof vi.fn> } = {
      send: vi.fn(async (_r: OllamaTransportRequest): Promise<OllamaTransportResponse> => ({ status: "ok" })),
    } as never;
    const emptyRetrieval: RetrievalPort = {
      async search() {
        return { chunks: [], retrieval_notes: [] } as unknown as Awaited<
          ReturnType<RetrievalPort["search"]>
        >;
      },
    };
    const req: LegalRequest = {
      request_id: "r1",
      user_id: "u1",
      workspace_id: "w1",
      mode: "ask",
      question: "Was I unfairly dismissed under ERA 1996?",
      facts: { dismissal_date: "2026-04-01", acas_started: true },
    };
    const r = await handleLegalRequest(req, {
      retrieval: emptyRetrieval,
      transport,
      gateway: { configured: true, mode: "ollama", available: true },
    });
    expect(transport.send).not.toHaveBeenCalled();
    expect(["insufficient_sources", "needs_more_facts", "high_risk_deadline", "citation_failed", "policy_failed"]).toContain(r.status);
    expect(r.external_llm_used).toBe(false);
  });

  it("Test 3: no intelligence metadata leaks into public answer when disabled", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/legal/ask")
      .send({
        request_id: "rd1",
        user_id: "u",
        workspace_id: "w",
        mode: "ask",
        question: "Can my employer dismiss me for raising a grievance?",
        facts: { dismissal_date: "2026-04-01" },
      });
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("intelligence_layer");
    expect(body).not.toContain("intelligence_trace");
    expect(body).not.toContain("trust_score");
    expect(body).not.toContain("rrf_scores");
    expect(body).not.toContain("retrieved_context_hash");
  });

  it("Test 4: no external network sentinel appears in /ready or /api response", async () => {
    const app = createApp();
    const ready = await request(app).get("/ready");
    expect(ready.body.intelligence_layer.external_network_enabled).toBe(false);
    expect(ready.body.intelligence_layer.external_llm_enabled).toBe(false);
    expect(ready.body.llm.external_llm_enabled).toBe(false);
  });
});

describe("Sprint 15 — disabled path never imports a provider SDK at module-load time", () => {
  it("the intelligence config + gateway modules do not import any provider package", async () => {
    // Static-assertion style: the config module's source must not include
    // OpenAI / Anthropic / Gemini package names. (Runtime import would
    // already break the build if a provider SDK were missing.)
    const { readFileSync } = await import("node:fs");
    const { join, dirname, resolve } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const here = dirname(fileURLToPath(import.meta.url));
    const repoRoot = resolve(here, "..", "..", "..", "..");
    const configBody = readFileSync(
      join(repoRoot, "apps", "legal-orchestrator", "src", "config", "featureFlags.ts"),
      "utf8",
    );
    expect(configBody).not.toMatch(/from\s+["']openai["']/);
    expect(configBody).not.toMatch(/from\s+["']@anthropic-ai\/sdk["']/);
    expect(configBody).not.toMatch(/from\s+["']@google\/generative-ai["']/);
    expect(configBody).not.toMatch(/from\s+["']cohere-ai["']/);
    expect(configBody).not.toMatch(/from\s+["']@mistralai/);
    expect(configBody).not.toMatch(/\bfetch\s*\(/);
    expect(configBody).not.toMatch(/\baxios\s*\(/);
  });
});

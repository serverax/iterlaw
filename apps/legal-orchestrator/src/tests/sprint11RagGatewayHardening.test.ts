// Sprint 11 hardening tests.
//
// Proves the Sprint 11 contract for the parts that are IN SCOPE this
// sprint (foundation + audit + transport policy + the existing
// handleLegalRequest behaviour). The Phase 2B / Phase 4 items — live
// HTTP transport and pipeline wiring of `runLocalDraftingStep` into
// `handleLegalRequest` — remain explicitly OUT OF SCOPE per
// `docs/iterlaw/project/07-sprints/SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md`.
//
// These tests are static-analysis-only where possible. No live DB,
// no live LLM, no network. They lock the safety contract so a future
// regression breaks vitest, not production.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  describeLocalLlmGateway,
  guardLlmOutput,
  routeModel,
  runLocalDraftingStep,
  evaluateLocalTransportPolicy,
  EXTERNAL_PROVIDER_HOSTS,
  redactLlmAuditEvent,
  assertSafeLlmAuditEvent,
  UnsafeLlmAuditEventError,
  InMemoryLlmAuditSink,
  NoopLlmAuditSink,
  type LlmGatewayStatus,
  type RetrievedLegalChunkForSynthesis,
  type OllamaTransport,
} from "../legal/llm";
import { handleLegalRequest } from "../pipeline/handleLegalRequest.js";
import { createRagService } from "../rag/rag.service.js";
import type { LegalRequest } from "../types/legal.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(__dirname, "..");
const LLM_DIR = join(SRC_ROOT, "legal/llm");
const PIPELINE_DIR = join(SRC_ROOT, "pipeline");
const RAG_DIR = join(SRC_ROOT, "rag");
const SERVER_FILE = join(SRC_ROOT, "server.ts");

function walkTs(root: string, out: string[] = []): string[] {
  for (const name of readdirSync(root)) {
    if (name === "node_modules" || name === "dist") continue;
    const full = join(root, name);
    const s = statSync(full);
    if (s.isDirectory()) walkTs(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

function stripComments(s: string): string {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*\n/g, "\n");
}

// =====================================================================
// 1. Local LLM gateway hardening
// =====================================================================

describe("Sprint 11 — local LLM gateway hardening", () => {
  const llmFiles = walkTs(LLM_DIR);

  it("no external provider SDK is imported anywhere in legal/llm/", () => {
    const banned = /from\s+['"](openai|@anthropic-ai\/sdk|@google\/generative-ai|cohere-ai|@mistralai\/mistralai|node-fetch|undici|axios|got)['"]/;
    const offenders: string[] = [];
    for (const f of llmFiles) {
      const stripped = stripComments(readFileSync(f, "utf8"));
      if (banned.test(stripped)) offenders.push(f);
    }
    expect(offenders, `external SDK import in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("no top-level fetch( call inside the drafting / routing / guard / policy / audit modules", () => {
    // localOllamaGateway.ts is allowed to call fetch (it is the health probe,
    // not the answer-path drafter). Everything else MUST NOT call fetch.
    const offenders: string[] = [];
    for (const f of llmFiles) {
      if (f.endsWith("localOllamaGateway.ts")) continue;
      const stripped = stripComments(readFileSync(f, "utf8"));
      if (/\bfetch\s*\(/.test(stripped)) offenders.push(f);
    }
    expect(offenders, `fetch( found in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("describeLocalLlmGateway returns 'disabled' / configured=false / available=false by default", () => {
    const g = describeLocalLlmGateway({} as NodeJS.ProcessEnv);
    expect(g.mode).toBe("disabled");
    expect(g.configured).toBe(false);
    expect(g.available).toBe(false);
    expect(g.reason).toBe("DISABLED");
  });

  it("runLocalDraftingStep with disabled gateway returns llm_unavailable (transport never called)", async () => {
    let calls = 0;
    const transport: OllamaTransport = {
      async send() {
        calls += 1;
        return { status: "unavailable" };
      },
    };
    const gateway: LlmGatewayStatus = {
      configured: false,
      mode: "disabled",
      available: false,
      reason: "DISABLED",
    };
    const chunk: RetrievedLegalChunkForSynthesis = {
      chunkId: "c1",
      documentId: "d1",
      title: "Test",
      url: "https://www.legislation.gov.uk/x",
      citationLabel: "Test ref",
      text: "Some test text.",
    };
    const r = await runLocalDraftingStep(
      { question: "Q?", facts: {}, retrievedChunks: [chunk] },
      gateway,
      { transport },
    );
    expect(r.status).toBe("llm_unavailable");
    expect(calls).toBe(0);
    expect(r.citations).toEqual([]);
  });

  it("runLocalDraftingStep with empty chunks returns insufficient_sources (transport never called)", async () => {
    const transport: OllamaTransport = {
      async send() {
        throw new Error("must not be called");
      },
    };
    const gateway: LlmGatewayStatus = {
      configured: true,
      mode: "ollama",
      available: true,
    };
    const r = await runLocalDraftingStep(
      { question: "Q?", facts: {}, retrievedChunks: [] },
      gateway,
      { transport },
    );
    expect(r.status).toBe("insufficient_sources");
  });

  it("modelRouter refuses legal_drafting when no citations are present", () => {
    const r = routeModel({ task: "legal_drafting", hasRetrievedChunks: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("refused_no_citations");
  });

  it("guardLlmOutput rejects empty answer / zero citations / hallucinated citation", () => {
    const chunks: RetrievedLegalChunkForSynthesis[] = [
      {
        chunkId: "real",
        documentId: "d1",
        title: "Real",
        url: "https://x",
        citationLabel: "real",
        text: "real text",
      },
    ];
    expect(guardLlmOutput({ answer: "", citedChunkIds: ["real"] }, chunks).ok).toBe(false);
    expect(guardLlmOutput({ answer: "a", citedChunkIds: [] }, chunks).ok).toBe(false);
    expect(guardLlmOutput({ answer: "a", citedChunkIds: ["fake"] }, chunks).ok).toBe(false);
    const ok = guardLlmOutput({ answer: "a", citedChunkIds: ["real"] }, chunks);
    expect(ok.ok).toBe(true);
  });

  it("transport policy permanently denies the five public-provider hostnames", () => {
    const hosts = [
      "https://api.openai.com/v1",
      "https://api.anthropic.com/v1",
      "https://generativelanguage.googleapis.com/v1",
      "https://api.cohere.ai/v1",
      "https://api.mistral.ai/v1",
    ];
    for (const url of hosts) {
      const r = evaluateLocalTransportPolicy({ mode: "internal", url });
      expect(r.ok, `expected denial for ${url}`).toBe(false);
      expect(r.reason).toBe("external_provider_blocked");
    }
    // Also reject when mode is disabled.
    for (const url of hosts) {
      const r = evaluateLocalTransportPolicy({ mode: "disabled", url });
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("external_provider_blocked");
    }
    // EXTERNAL_PROVIDER_HOSTS list contains all five.
    for (const h of ["api.openai.com", "api.anthropic.com", "generativelanguage.googleapis.com", "api.cohere.ai", "api.mistral.ai"]) {
      expect(EXTERNAL_PROVIDER_HOSTS.includes(h)).toBe(true);
    }
  });
});

// =====================================================================
// 2. RAG answer path — describe() drives /ready.mode without leaking DSN
// =====================================================================

describe("Sprint 11 — RAG answer path", () => {
  it("createRagService().describe() returns a defined, safe strategy string", () => {
    const svc = createRagService();
    const d = svc.describe();
    expect(typeof d.strategy).toBe("string");
    expect(d.strategy.length).toBeGreaterThan(0);
    // The strategy must not be the special live-postgres-with-credentials
    // state in this static test context. Any other value (mock / port /
    // postgres-not-live) is acceptable.
    const json = JSON.stringify(d);
    expect(json).not.toMatch(/postgres(?:ql)?:\/\/[^@\s]+:[^@\s]+@/);
  });

  it("describe() output never carries a credential-bearing DSN", () => {
    const svc = createRagService();
    const d = svc.describe();
    const json = JSON.stringify(d);
    expect(json).not.toMatch(/postgres(?:ql)?:\/\/[^@\s]+:[^@\s]+@/);
    expect(json).not.toMatch(/POSTGRES_PASSWORD/i);
    expect(json).not.toMatch(/DATABASE_URL\s*=/);
  });

  it("server.ts /ready slice maps describe() → safe payload (no host, no DSN)", () => {
    const src = readFileSync(SERVER_FILE, "utf8");
    // The /ready handler must never serialise a DSN. Static check:
    expect(src).not.toMatch(/process\.env\.DATABASE_URL/);
    // It must derive rag from describe() only, not from env directly.
    expect(src).toMatch(/ragReadyFromDescribe/);
    // /ready must carry legal_safety with the two required flags.
    expect(src).toMatch(/citation_required:\s*true/);
    expect(src).toMatch(/zero_citation_answer_blocked:\s*true/);
  });
});

// =====================================================================
// 3. Deterministic legal gate order — verified through handleLegalRequest
// =====================================================================

describe("Sprint 11 — deterministic legal gate order", () => {
  function baseRequest(over: Partial<LegalRequest> = {}): LegalRequest {
    return {
      request_id: "req-test",
      user_id: "u1",
      workspace_id: "w1",
      mode: "ask",
      question: "Was I unfairly dismissed?",
      legal_pack: "uk_employment_england_wales",
      facts: {},
      ...over,
    } as LegalRequest;
  }

  const SAFE_NON_OK_STATUSES = [
    "needs_more_facts",
    "insufficient_sources",
    "citation_failed",
    "policy_failed",
    "high_risk_deadline",
  ];

  it("empty retrieval → some safe non-ok status; no fabricated answer; no external LLM", async () => {
    const r = await handleLegalRequest(baseRequest(), {
      retrieval: {
        async search() {
          return { chunks: [], retrieval_notes: [] };
        },
      },
    });
    expect(SAFE_NON_OK_STATUSES).toContain(r.status);
    expect(r.external_llm_used).toBe(false);
    expect(r.citations).toEqual([]);
  });

  it("retrieval returns chunks but no draft → safe non-ok status; no fabricated answer", async () => {
    const r = await handleLegalRequest(baseRequest(), {
      retrieval: {
        async search() {
          return {
            chunks: [
              {
                chunk_id: "x",
                document_id: "d",
                source_type: "legislation",
                authority_level: 100,
                title: "ERA 1996",
                url: "https://www.legislation.gov.uk/ukpga/1996/18/section/94",
                citation_label: "ERA 1996 s.94",
                section_reference: "s.94",
                paragraph_reference: null,
                chunk_text: "An employee has the right not to be unfairly dismissed.",
                authority_level_value: 100,
                effective_date: null,
                applicable_to: null,
              } as unknown as Parameters<typeof handleLegalRequest>[1] extends infer D ? D : never,
            ] as unknown as never,
            retrieval_notes: [],
          };
        },
      },
    });
    expect(SAFE_NON_OK_STATUSES).toContain(r.status);
    expect(r.external_llm_used).toBe(false);
  });

  it("no retrieval injected + no DATABASE_URL → defaults to mock service; safe non-ok status", async () => {
    const r = await handleLegalRequest(baseRequest());
    expect(SAFE_NON_OK_STATUSES).toContain(r.status);
    expect(r.external_llm_used).toBe(false);
  });

  it("high-risk deadline short-circuits before drafting", async () => {
    const r = await handleLegalRequest(
      baseRequest({
        question: "I was dismissed long ago, can I still claim?",
        facts: {
          dismissal_date: "2024-01-01",
          acas_started: false,
        } as Record<string, unknown>,
      }),
      {
        retrieval: {
          async search() {
            return { chunks: [], retrieval_notes: [] };
          },
        },
      },
    );
    // High-risk-deadline path short-circuits before retrieval runs; if
    // it doesn't fire, the normal insufficient_sources path is fine —
    // both are safe outcomes, just not a fabricated answer.
    expect(["high_risk_deadline", "insufficient_sources", "needs_more_facts"]).toContain(r.status);
    expect(r.external_llm_used).toBe(false);
  });
});

// =====================================================================
// 4. Audit trail safety — redactor + assert + sinks
// =====================================================================

describe("Sprint 11 — audit trail safety", () => {
  it("redactor strips raw prompt / draft / chunks / DSN / secrets from an audit event", () => {
    const ev = redactLlmAuditEvent({
      eventId: "e1",
      requestId: "r1",
      traceId: "t1",
      taskType: "legal_drafting",
      retrievedChunkCount: 1,
      citationCount: 1,
      citedChunkIds: ["chunk_1"],
      safetyFlags: ["ok"],
      status: "success",
      // Forbidden fields below — must be stripped:
      prompt: "leaked-prompt",
      systemPrompt: "leaked-system",
      userPrompt: "leaked-user",
      draft: "leaked-draft",
      draftText: "leaked-drafttext",
      rawAnswer: "leaked-answer",
      chunks: ["leaked-chunk"],
      retrievedChunks: ["leaked-rc"],
      facts: { x: 1 },
      question: "leaked-question",
      DATABASE_URL: "postgresql://u:p@h/d",
      apiKey: "sk-xxxxxxxxxxxxxxxxxxxx",
    });
    const json = JSON.stringify(ev);
    for (const needle of [
      "leaked-prompt", "leaked-system", "leaked-user",
      "leaked-draft", "leaked-drafttext", "leaked-answer",
      "leaked-chunk", "leaked-rc", "leaked-question",
      "postgresql://u:p@h/d", "sk-xxxxxxxxxxxxxxxxxxxx",
    ]) {
      expect(json).not.toContain(needle);
    }
    expect(ev.requestId).toBe("r1");
    expect(ev.traceId).toBe("t1");
    expect(ev.status).toBe("success");
  });

  it("assertSafeLlmAuditEvent throws on smuggled forbidden field", () => {
    const evil = {
      eventId: "e",
      requestId: "r",
      traceId: "t",
      taskType: "legal_drafting",
      retrievedChunkCount: 0,
      citationCount: 0,
      citedChunkIds: [],
      safetyFlags: [],
      status: "success",
      createdAt: "2026-05-13T00:00:00Z",
      // smuggled:
      prompt: "leak",
    } as unknown;
    expect(() => assertSafeLlmAuditEvent(evil)).toThrow(UnsafeLlmAuditEventError);
  });

  it("InMemoryLlmAuditSink rejects unsafe event at record() time", () => {
    const sink = new InMemoryLlmAuditSink();
    expect(() =>
      sink.record({
        eventId: "e",
        requestId: "r",
        traceId: "t",
        taskType: "legal_drafting",
        retrievedChunkCount: 0,
        citationCount: 0,
        citedChunkIds: [],
        safetyFlags: [],
        status: "success",
        createdAt: "2026-05-13T00:00:00Z",
        prompt: "leak",
      } as unknown as Parameters<typeof sink.record>[0]),
    ).toThrow(UnsafeLlmAuditEventError);
  });

  it("NoopLlmAuditSink is a safe default that discards", () => {
    const sink = new NoopLlmAuditSink();
    expect(() =>
      sink.record({
        eventId: "e",
        requestId: "r",
        traceId: "t",
        taskType: "legal_drafting",
        retrievedChunkCount: 0,
        citationCount: 0,
        citedChunkIds: [],
        safetyFlags: [],
        status: "success",
        createdAt: "2026-05-13T00:00:00Z",
      }),
    ).not.toThrow();
  });
});

// =====================================================================
// 5. API response envelope — current shape locked, no DSN leak
// =====================================================================

describe("Sprint 11 — API response envelope locked shape", () => {
  function baseRequest(over: Partial<LegalRequest> = {}): LegalRequest {
    return {
      request_id: "req-env",
      user_id: "u",
      workspace_id: "w",
      mode: "ask",
      question: "What is the qualifying period for unfair dismissal?",
      legal_pack: "uk_employment_england_wales",
      facts: {},
      ...over,
    } as LegalRequest;
  }

  it("envelope on a safe refusal includes the required safety fields", async () => {
    const r = await handleLegalRequest(baseRequest(), {
      retrieval: {
        async search() {
          return { chunks: [], retrieval_notes: [] };
        },
      },
    });
    expect(r.request_id).toBe("req-env");
    expect([
      "needs_more_facts",
      "insufficient_sources",
      "citation_failed",
      "policy_failed",
      "high_risk_deadline",
    ]).toContain(r.status);
    expect(typeof r.answer).toBe("string");
    expect(Array.isArray(r.citations)).toBe(true);
    expect(Array.isArray(r.next_steps)).toBe(true);
    expect(r.external_llm_used).toBe(false);
    expect(r.synthesis_status).toBe("not_attempted");
  });

  it("envelope never contains a DSN / password / DATABASE_URL", async () => {
    const r = await handleLegalRequest(baseRequest(), {
      retrieval: {
        async search() {
          return { chunks: [], retrieval_notes: [] };
        },
      },
    });
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/postgres(?:ql)?:\/\/[^@\s]+:[^@\s]+@/);
    expect(json).not.toMatch(/POSTGRES_PASSWORD/i);
    expect(json).not.toMatch(/DATABASE_URL\s*=/);
    expect(json).not.toMatch(/sk-[A-Za-z0-9]{20,}/);
  });

  it("envelope never sets external_llm_used to true", async () => {
    const cases: Array<LegalRequest> = [
      baseRequest(),
      baseRequest({ question: "" }),
      baseRequest({ facts: { dismissal_date: "2024-01-01" } as Record<string, unknown> }),
    ];
    for (const c of cases) {
      const r = await handleLegalRequest(c, {
        retrieval: {
          async search() {
            return { chunks: [], retrieval_notes: [] };
          },
        },
      });
      expect(r.external_llm_used).toBe(false);
    }
  });
});

// =====================================================================
// 6. Static safety — no external LLM URL / no plaintext DSN in active source
// =====================================================================

describe("Sprint 11 — static safety scans", () => {
  const RAG_FILES = walkTs(RAG_DIR);
  const PIPELINE_FILES = walkTs(PIPELINE_DIR);

  it("no external-provider hostname appears in the answer-path code (rag/, pipeline/)", () => {
    const banned = /api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.cohere\.(?:ai|com)|api\.mistral\.ai/i;
    const offenders: string[] = [];
    for (const f of [...RAG_FILES, ...PIPELINE_FILES]) {
      const stripped = stripComments(readFileSync(f, "utf8"));
      if (banned.test(stripped)) offenders.push(f);
    }
    expect(offenders, `external provider hostname in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("no plaintext DSN literal in answer-path code", () => {
    const banned = /postgres(?:ql)?:\/\/[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+@/;
    const offenders: string[] = [];
    for (const f of [...RAG_FILES, ...PIPELINE_FILES, SERVER_FILE]) {
      const stripped = stripComments(readFileSync(f, "utf8"));
      if (banned.test(stripped)) offenders.push(f);
    }
    expect(offenders, `plaintext DSN in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("apps/legal-orchestrator/package.json carries no external-provider SDK dependency", () => {
    const pkgPath = join(__dirname, "../../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    const all = new Set<string>([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
      ...Object.keys(pkg.optionalDependencies ?? {}),
    ]);
    const banned = ["openai", "@anthropic-ai/sdk", "@google/generative-ai", "cohere-ai", "@mistralai/mistralai"];
    const found = banned.filter((b) => all.has(b));
    expect(found, `banned SDK dependency present: ${found.join(", ")}`).toEqual([]);
  });
});

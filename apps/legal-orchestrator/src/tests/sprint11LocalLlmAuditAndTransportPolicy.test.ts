// Sprint 11 Phase 2A — audit redaction + transport policy guard tests.
// No network calls. No DB. Audit sinks are tested with the in-memory
// implementation. The drafting helper is exercised with a mock
// transport, identical to Sprint 11 Phase 1.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertSafeLlmAuditEvent,
  describeLocalLlmGateway as _describeLocalLlmGateway,
  evaluateLocalTransportPolicy,
  EXTERNAL_PROVIDER_HOSTS,
  InMemoryLlmAuditSink,
  NoopLlmAuditSink,
  redactLlmAuditEvent,
  runLocalDraftingStep,
  UnsafeLlmAuditEventError,
  validateLocalTransportTarget,
  type BoundedSynthesisInput,
  type LlmGatewayStatus,
  type LocalLlmAuditEvent,
  type OllamaTransport,
  type OllamaTransportResponse,
  type RetrievedLegalChunkForSynthesis,
} from "../legal/llm";

void _describeLocalLlmGateway;

const __dirname = dirname(fileURLToPath(import.meta.url));
const LLM_DIR = join(__dirname, "../legal/llm");

function makeChunk(
  overrides: Partial<RetrievedLegalChunkForSynthesis> = {},
): RetrievedLegalChunkForSynthesis {
  return {
    chunkId: "chunk_era_95",
    documentId: "doc_era_1996",
    title: "Employment Rights Act 1996 s.95",
    url: "https://www.legislation.gov.uk/ukpga/1996/18/section/95",
    citationLabel: "ERA 1996 s.95(1)",
    text: "An employee is dismissed by his employer if the contract under which he is employed is terminated by the employer.",
    sourceType: "legislation",
    effectiveDate: "1996-08-22",
    ...overrides,
  };
}

function makeGateway(overrides: Partial<LlmGatewayStatus> = {}): LlmGatewayStatus {
  return {
    configured: false,
    mode: "disabled",
    available: false,
    reason: "DISABLED",
    ...overrides,
  };
}

function makeInput(
  chunks: RetrievedLegalChunkForSynthesis[],
): BoundedSynthesisInput {
  return {
    question: "Am I dismissed under ERA 1996 if my contract is terminated without notice?",
    facts: { dismissal_date: "2026-05-01" },
    retrievedChunks: chunks,
  };
}

function makeMockTransport(
  responses: OllamaTransportResponse[],
): OllamaTransport & { calls: number } {
  let i = 0;
  const t = {
    calls: 0,
    async send() {
      t.calls += 1;
      const r = responses[i] ?? { status: "unavailable" as const };
      i += 1;
      return r;
    },
  };
  return t;
}

const FIXED_NOW = "2026-05-12T10:00:00.000Z";
const fixedClock = () => FIXED_NOW;
let counter = 0;
const fixedEventIdFactory = () => `evt_${(++counter).toString().padStart(4, "0")}`;

// ---------------------------------------------------------------------
// redactLlmAuditEvent
// ---------------------------------------------------------------------

describe("redactLlmAuditEvent — strips dangerous fields", () => {
  it("ignores raw prompt / userPrompt / systemPrompt fields", () => {
    const r = redactLlmAuditEvent(
      {
        eventId: "evt_1",
        requestId: "req_1",
        traceId: "tr_1",
        taskType: "legal_drafting",
        retrievedChunkCount: 2,
        citationCount: 1,
        citedChunkIds: ["chunk_era_95"],
        status: "success",
        safetyFlags: [],
        createdAt: FIXED_NOW,
        prompt: "MUST NOT LEAK",
        systemPrompt: "MUST NOT LEAK",
        userPrompt: "MUST NOT LEAK",
      },
      { now: fixedClock },
    ) as Record<string, unknown>;
    expect(r).not.toHaveProperty("prompt");
    expect(r).not.toHaveProperty("systemPrompt");
    expect(r).not.toHaveProperty("userPrompt");
    const json = JSON.stringify(r);
    expect(json).not.toContain("MUST NOT LEAK");
  });

  it("ignores draftText / rawAnswer / modelOutput fields", () => {
    const r = redactLlmAuditEvent(
      {
        eventId: "evt_2",
        requestId: "req_2",
        traceId: "tr_2",
        taskType: "drafting_letter",
        retrievedChunkCount: 1,
        citationCount: 1,
        citedChunkIds: ["chunk_era_95"],
        status: "success",
        safetyFlags: [],
        draftText: "MUST NOT LEAK answer body",
        rawAnswer: "MUST NOT LEAK",
        modelOutput: "MUST NOT LEAK",
        modelText: "MUST NOT LEAK",
      },
      { now: fixedClock },
    ) as Record<string, unknown>;
    const json = JSON.stringify(r);
    expect(json).not.toContain("MUST NOT LEAK");
    expect(r).not.toHaveProperty("draftText");
    expect(r).not.toHaveProperty("rawAnswer");
  });

  it("ignores DATABASE_URL / postgres DSN and dropped string fields", () => {
    const r = redactLlmAuditEvent(
      {
        eventId: "evt_3",
        requestId: "req_3",
        traceId: "tr_3",
        taskType: "legal_drafting",
        retrievedChunkCount: 1,
        citationCount: 1,
        citedChunkIds: ["chunk_era_95"],
        status: "success",
        safetyFlags: [],
        DATABASE_URL: "postgres://user:pa55@db.internal:5432/iterlaw",
        databaseUrl: "postgres://user:pa55@db.internal:5432/iterlaw",
      },
      { now: fixedClock },
    ) as Record<string, unknown>;
    const json = JSON.stringify(r);
    expect(json).not.toContain("postgres://");
    expect(json).not.toContain("pa55");
    expect(r).not.toHaveProperty("DATABASE_URL");
    expect(r).not.toHaveProperty("databaseUrl");
  });

  it("ignores api_key / apiKey / secret / token / password fields", () => {
    const sample = "sk-abcdefghijklmnopqrstuvwxyz1234567890ABCD";
    const r = redactLlmAuditEvent(
      {
        eventId: "evt_4",
        requestId: "req_4",
        traceId: "tr_4",
        taskType: "small_helper",
        retrievedChunkCount: 0,
        citationCount: 0,
        citedChunkIds: [],
        status: "skipped",
        safetyFlags: [],
        apiKey: sample,
        api_key: sample,
        secret: sample,
        password: sample,
        token: sample,
      },
      { now: fixedClock },
    ) as Record<string, unknown>;
    const json = JSON.stringify(r);
    expect(json).not.toContain(sample);
    for (const k of ["apiKey", "api_key", "secret", "password", "token"]) {
      expect(r).not.toHaveProperty(k);
    }
  });

  it("preserves requestId / traceId / taskType / status / counts", () => {
    const r = redactLlmAuditEvent(
      {
        eventId: "evt_5",
        requestId: "req_xyz",
        traceId: "trace_xyz",
        taskType: "legal_drafting",
        selectedModel: "uk-employment-qwen:latest",
        retrievedChunkCount: 3,
        citationCount: 2,
        citedChunkIds: ["a", "b"],
        safetyFlags: ["transport_missing"],
        status: "unavailable",
        latencyMs: 42,
      },
      { now: fixedClock },
    );
    expect(r.eventId).toBe("evt_5");
    expect(r.requestId).toBe("req_xyz");
    expect(r.traceId).toBe("trace_xyz");
    expect(r.taskType).toBe("legal_drafting");
    expect(r.selectedModel).toBe("uk-employment-qwen:latest");
    expect(r.retrievedChunkCount).toBe(3);
    expect(r.citationCount).toBe(2);
    expect(r.citedChunkIds).toEqual(["a", "b"]);
    expect(r.status).toBe("unavailable");
    expect(r.safetyFlags).toEqual(["transport_missing"]);
    expect(r.latencyMs).toBe(42);
  });

  it("uses provided clock if createdAt missing", () => {
    const r = redactLlmAuditEvent(
      {
        eventId: "evt_6",
        requestId: "r",
        traceId: "t",
        taskType: "legal_drafting",
        retrievedChunkCount: 0,
        citationCount: 0,
        citedChunkIds: [],
        safetyFlags: [],
        status: "skipped",
      },
      { now: fixedClock },
    );
    expect(r.createdAt).toBe(FIXED_NOW);
  });

  it("invalid status / task / model fall back to safe defaults", () => {
    const r = redactLlmAuditEvent(
      {
        eventId: "evt_7",
        requestId: "r",
        traceId: "t",
        taskType: "WRONG",
        selectedModel: "gpt-4-turbo",
        status: "EVIL",
        retrievedChunkCount: -1,
        citationCount: "many",
        citedChunkIds: ["good", "has space", "postgres://u:p@h/d", "https://x", 123, null],
        safetyFlags: [123, null, "ok flag"],
      },
      { now: fixedClock },
    );
    expect(r.taskType).toBe("unknown");
    expect(r.selectedModel).toBeUndefined();
    expect(r.status).toBe("error");
    expect(r.retrievedChunkCount).toBe(0);
    expect(r.citationCount).toBe(0);
    expect(r.citedChunkIds).toEqual(["good"]);
    expect(r.safetyFlags).toEqual(["ok flag"]);
  });
});

// ---------------------------------------------------------------------
// assertSafeLlmAuditEvent
// ---------------------------------------------------------------------

describe("assertSafeLlmAuditEvent — rejects unsafe values", () => {
  function baseEvent(overrides: Partial<LocalLlmAuditEvent> = {}): LocalLlmAuditEvent {
    return {
      eventId: "evt_assert_1",
      requestId: "req_assert_1",
      traceId: "trace_assert_1",
      taskType: "legal_drafting",
      retrievedChunkCount: 1,
      citationCount: 1,
      citedChunkIds: ["chunk_era_95"],
      safetyFlags: [],
      status: "success",
      createdAt: FIXED_NOW,
      ...overrides,
    };
  }

  it("accepts a clean event", () => {
    expect(() => assertSafeLlmAuditEvent(baseEvent())).not.toThrow();
  });

  it("rejects when a forbidden field (`prompt`) is present", () => {
    const e = { ...baseEvent(), prompt: "leak" } as unknown;
    expect(() => assertSafeLlmAuditEvent(e)).toThrow(UnsafeLlmAuditEventError);
  });

  it("rejects when a forbidden field (`draftText`) is present", () => {
    const e = { ...baseEvent(), draftText: "leak" } as unknown;
    expect(() => assertSafeLlmAuditEvent(e)).toThrow(UnsafeLlmAuditEventError);
  });

  it("rejects when traceId is secret-shaped", () => {
    const e = baseEvent({ traceId: "postgres://u:p@h.example/db" });
    expect(() => assertSafeLlmAuditEvent(e)).toThrow(UnsafeLlmAuditEventError);
  });

  it("rejects when safetyFlags contains a secret-shape literal", () => {
    const e = baseEvent({ safetyFlags: ["ghp_abcdefghijklmnopqrstuv"] });
    expect(() => assertSafeLlmAuditEvent(e)).toThrow(UnsafeLlmAuditEventError);
  });

  it("rejects when status is invalid", () => {
    const e = { ...baseEvent(), status: "made_up" } as unknown;
    expect(() => assertSafeLlmAuditEvent(e)).toThrow(UnsafeLlmAuditEventError);
  });
});

// ---------------------------------------------------------------------
// audit sinks
// ---------------------------------------------------------------------

describe("audit sinks", () => {
  it("NoopLlmAuditSink swallows events without error", () => {
    const sink = new NoopLlmAuditSink();
    expect(() =>
      sink.record({
        eventId: "evt_noop",
        requestId: "r",
        traceId: "t",
        taskType: "legal_drafting",
        retrievedChunkCount: 0,
        citationCount: 0,
        citedChunkIds: [],
        safetyFlags: [],
        status: "skipped",
        createdAt: FIXED_NOW,
      }),
    ).not.toThrow();
  });

  it("InMemoryLlmAuditSink rejects an unsafe event (defence in depth)", () => {
    const sink = new InMemoryLlmAuditSink();
    const unsafe = {
      eventId: "evt_bad",
      requestId: "r",
      traceId: "t",
      taskType: "legal_drafting",
      retrievedChunkCount: 0,
      citationCount: 0,
      citedChunkIds: [],
      safetyFlags: [],
      status: "success",
      createdAt: FIXED_NOW,
      // Forbidden field smuggled in past the type:
      prompt: "LEAK",
    } as unknown as LocalLlmAuditEvent;
    expect(() => sink.record(unsafe)).toThrow(UnsafeLlmAuditEventError);
    expect(sink.size()).toBe(0);
  });

  it("InMemoryLlmAuditSink stores only redacted events and exposes size()", () => {
    const sink = new InMemoryLlmAuditSink();
    const safe = redactLlmAuditEvent(
      {
        eventId: "evt_mem_1",
        requestId: "r",
        traceId: "t",
        taskType: "legal_drafting",
        retrievedChunkCount: 1,
        citationCount: 1,
        citedChunkIds: ["a"],
        safetyFlags: [],
        status: "success",
        prompt: "LEAK",
      },
      { now: fixedClock },
    );
    sink.record(safe);
    expect(sink.size()).toBe(1);
    expect(sink.events[0]).not.toHaveProperty("prompt");
    expect(JSON.stringify(sink.events[0])).not.toContain("LEAK");
    sink.clear();
    expect(sink.size()).toBe(0);
  });
});

// ---------------------------------------------------------------------
// runLocalDraftingStep — audit emission
// ---------------------------------------------------------------------

describe("runLocalDraftingStep — audit emission", () => {
  it("emits a `disabled` audit event when gateway disabled and sink injected", async () => {
    counter = 0;
    const sink = new InMemoryLlmAuditSink();
    await runLocalDraftingStep(
      makeInput([makeChunk()]),
      makeGateway(),
      {
        auditSink: sink,
        now: fixedClock,
        eventIdFactory: fixedEventIdFactory,
        requestId: "req_disabled",
        traceId: "trace_disabled",
      },
    );
    expect(sink.size()).toBe(1);
    const e = sink.events[0]!;
    expect(e.status).toBe("disabled");
    expect(e.requestId).toBe("req_disabled");
    expect(e.traceId).toBe("trace_disabled");
    expect(e.safetyFlags).toContain("gateway_unavailable");
    // No leak surfaces:
    expect(e).not.toHaveProperty("prompt");
    expect(e).not.toHaveProperty("answer");
    expect(e).not.toHaveProperty("draftText");
  });

  it("emits an `unavailable` audit event when transport is missing", async () => {
    counter = 0;
    const sink = new InMemoryLlmAuditSink();
    await runLocalDraftingStep(
      makeInput([makeChunk()]),
      makeGateway({ configured: true, available: true }),
      {
        auditSink: sink,
        now: fixedClock,
        eventIdFactory: fixedEventIdFactory,
        requestId: "req_no_transport",
        traceId: "trace_no_transport",
      },
    );
    expect(sink.size()).toBe(1);
    const e = sink.events[0]!;
    expect(e.status).toBe("unavailable");
    expect(e.refusalReason).toBe("transport_missing");
    expect(e.safetyFlags).toContain("transport_missing");
    expect(e.selectedModel).toBe("uk-employment-qwen:latest");
  });

  it("emits a `citation_failed` audit event when output guard rejects", async () => {
    counter = 0;
    const sink = new InMemoryLlmAuditSink();
    const transport = makeMockTransport([
      {
        status: "ok",
        answer: "Per [fake_id], ...",
        citedChunkIds: ["fake_id"],
        modelUsed: "uk-employment-qwen:latest",
        latencyMs: 200,
      },
    ]);
    const r = await runLocalDraftingStep(
      makeInput([makeChunk()]),
      makeGateway({ configured: true, available: true }),
      {
        transport,
        auditSink: sink,
        now: fixedClock,
        eventIdFactory: fixedEventIdFactory,
        requestId: "req_cite_fail",
        traceId: "trace_cite_fail",
      },
    );
    expect(r.status).toBe("citation_failed");
    expect(sink.size()).toBe(1);
    const e = sink.events[0]!;
    expect(e.status).toBe("citation_failed");
    expect(e.refusalReason).toBe("hallucinated_citation");
    expect(e.latencyMs).toBe(200);
  });

  it("emits a `success` audit event when synthesised, with citation count and ids", async () => {
    counter = 0;
    const sink = new InMemoryLlmAuditSink();
    const transport = makeMockTransport([
      {
        status: "ok",
        answer: "Per [chunk_era_95], an employee is dismissed when ...",
        citedChunkIds: ["chunk_era_95"],
        modelUsed: "uk-employment-qwen:latest",
        latencyMs: 950,
      },
    ]);
    const r = await runLocalDraftingStep(
      makeInput([makeChunk()]),
      makeGateway({ configured: true, available: true }),
      {
        transport,
        auditSink: sink,
        now: fixedClock,
        eventIdFactory: fixedEventIdFactory,
        requestId: "req_ok",
        traceId: "trace_ok",
      },
    );
    expect(r.status).toBe("synthesised");
    expect(sink.size()).toBe(1);
    const e = sink.events[0]!;
    expect(e.status).toBe("success");
    expect(e.citationCount).toBe(1);
    expect(e.citedChunkIds).toEqual(["chunk_era_95"]);
    expect(e.latencyMs).toBe(950);
    // Never leaks raw text.
    expect(e).not.toHaveProperty("answer");
    expect(JSON.stringify(e)).not.toContain("employee is dismissed");
  });

  it("does NOT emit when no sink is injected (back-compat)", async () => {
    const r = await runLocalDraftingStep(
      makeInput([makeChunk()]),
      makeGateway(),
      {},
    );
    expect(r.status).toBe("llm_unavailable");
    // Nothing to assert — but the absence of throws confirms no implicit sink.
  });

  it("emits an `insufficient_sources` audit event when no retrieved chunks", async () => {
    counter = 0;
    const sink = new InMemoryLlmAuditSink();
    const r = await runLocalDraftingStep(
      makeInput([]),
      makeGateway({ configured: true, available: true }),
      {
        auditSink: sink,
        now: fixedClock,
        eventIdFactory: fixedEventIdFactory,
        requestId: "req_no_chunks",
        traceId: "trace_no_chunks",
      },
    );
    expect(r.status).toBe("insufficient_sources");
    expect(sink.size()).toBe(1);
    const e = sink.events[0]!;
    expect(e.status).toBe("insufficient_sources");
    expect(e.retrievedChunkCount).toBe(0);
    expect(e.safetyFlags).toContain("no_retrieved_chunks");
  });
});

// ---------------------------------------------------------------------
// evaluateLocalTransportPolicy
// ---------------------------------------------------------------------

describe("evaluateLocalTransportPolicy — denies external providers", () => {
  it("disabled mode without URL is OK", () => {
    const r = evaluateLocalTransportPolicy({ mode: "disabled" });
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("policy_disabled");
  });

  it("disabled mode is the default when mode is omitted", () => {
    const r = evaluateLocalTransportPolicy({});
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("policy_disabled");
  });

  it("rejects OpenAI host even when mode is disabled", () => {
    const r = evaluateLocalTransportPolicy({
      mode: "disabled",
      url: "https://api.openai.com/v1/chat/completions",
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("external_provider_blocked");
    expect(r.host).toBe("api.openai.com");
  });

  it("rejects Anthropic host", () => {
    const r = evaluateLocalTransportPolicy({
      mode: "internal",
      url: "https://api.anthropic.com/v1/messages",
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("external_provider_blocked");
    expect(r.host).toBe("api.anthropic.com");
  });

  it("rejects Gemini host", () => {
    const r = evaluateLocalTransportPolicy({
      mode: "internal",
      url: "https://generativelanguage.googleapis.com/v1/models",
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("external_provider_blocked");
  });

  it("rejects Cohere and Mistral hosts", () => {
    for (const url of [
      "https://api.cohere.ai/v1/generate",
      "https://api.mistral.ai/v1/chat/completions",
    ]) {
      const r = evaluateLocalTransportPolicy({ mode: "internal", url });
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("external_provider_blocked");
    }
  });

  it("rejects generic external https by default in internal mode", () => {
    const r = evaluateLocalTransportPolicy({
      mode: "internal",
      url: "https://example.com/api",
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("external_https_blocked");
  });

  it("rejects unknown internal http host without explicit allow-list", () => {
    const r = evaluateLocalTransportPolicy({
      mode: "internal",
      url: "http://random-lan.example.test:11434",
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("host_not_allowed");
  });

  it("allows http://localhost", () => {
    const r = evaluateLocalTransportPolicy({
      mode: "internal",
      url: "http://localhost:11434/api/chat",
    });
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("url_allowed_loopback");
    expect(r.host).toBe("localhost");
  });

  it("allows http://127.0.0.1", () => {
    const r = evaluateLocalTransportPolicy({
      mode: "internal",
      url: "http://127.0.0.1:11434/api/chat",
    });
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("url_allowed_loopback");
    expect(r.host).toBe("127.0.0.1");
  });

  it("allows internal cluster DNS (.svc)", () => {
    const r = evaluateLocalTransportPolicy({
      mode: "internal",
      url: "http://ollama.iterlaw-ai.svc:11434/api/chat",
    });
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("url_allowed_cluster_dns");
  });

  it("allows internal cluster DNS (.svc.cluster.local)", () => {
    const r = evaluateLocalTransportPolicy({
      mode: "internal",
      url: "http://ollama.iterlaw-ai.svc.cluster.local:11434/api/chat",
    });
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("url_allowed_cluster_dns");
  });

  it("validateLocalTransportTarget wraps the policy and defaults to disabled", () => {
    expect(validateLocalTransportTarget({}).ok).toBe(true);
    expect(validateLocalTransportTarget({}).reason).toBe("policy_disabled");
    const r = validateLocalTransportTarget({
      enabled: true,
      url: "https://api.openai.com/v1",
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("external_provider_blocked");
  });

  it("rejects non-http(s) schemes", () => {
    const r = evaluateLocalTransportPolicy({
      mode: "internal",
      url: "ftp://internal.lan:21",
      allowedInternalHosts: ["internal.lan"],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("scheme_not_allowed");
  });

  it("rejects invalid URL strings", () => {
    const r = evaluateLocalTransportPolicy({
      mode: "internal",
      url: "not-a-url",
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("invalid_url");
  });

  it("allows explicit internal http host when on the allow-list", () => {
    // Pick a host that does NOT hit the auto-allow loopback or cluster-DNS
    // paths, so we can confirm the explicit allow-list branch is reached.
    const r = evaluateLocalTransportPolicy({
      mode: "internal",
      url: "http://ollama.iterlaw-internal:11434/api/chat",
      allowedInternalHosts: ["ollama.iterlaw-internal"],
    });
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("url_allowed");
  });

  it("EXTERNAL_PROVIDER_HOSTS list includes all five providers", () => {
    for (const banned of [
      "api.openai.com",
      "api.anthropic.com",
      "generativelanguage.googleapis.com",
      "api.cohere.ai",
      "api.mistral.ai",
    ]) {
      expect(EXTERNAL_PROVIDER_HOSTS.includes(banned)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------
// Static safety — no live HTTP implementation snuck in
// ---------------------------------------------------------------------

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

describe("Sprint 11 Phase 2A static safety — no live HTTP transport", () => {
  const files = walkTs(LLM_DIR);

  it("no `fetch(` call appears anywhere in legal/llm/", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const body = readFileSync(f, "utf8")
        .replace(/\/\/[^\n]*\n/g, "\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      if (/\bfetch\s*\(/.test(body)) offenders.push(f);
    }
    expect(offenders, `fetch( in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("no http/https library import in legal/llm/", () => {
    const banned = /from\s+['"](node-fetch|undici|axios|got|http|https|node:http|node:https)['"]/;
    const offenders: string[] = [];
    for (const f of files) {
      const body = readFileSync(f, "utf8")
        .replace(/\/\/[^\n]*\n/g, "\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      if (banned.test(body)) offenders.push(f);
    }
    expect(offenders, `http(s) import in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("no external provider SDK in apps/legal-orchestrator/package.json", () => {
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
    const banned = [
      "openai",
      "@anthropic-ai/sdk",
      "@google/generative-ai",
      "cohere-ai",
      "@mistralai/mistralai",
    ];
    const found = banned.filter((b) => all.has(b));
    expect(found, `banned SDK dependency present: ${found.join(", ")}`).toEqual([]);
  });
});

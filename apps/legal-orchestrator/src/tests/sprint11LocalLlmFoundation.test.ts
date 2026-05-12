// Sprint 11 — local LLM foundation: router / prompt / output guard /
// disabled-by-default drafting step. No network calls. All tests use
// in-memory data; the transport is mocked.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildCitationBoundPrompt,
  guardLlmOutput,
  routeModel,
  runLocalDraftingStep,
  type BoundedSynthesisInput,
  type LlmGatewayStatus,
  type LlmRawOutput,
  type OllamaTransport,
  type OllamaTransportResponse,
  type RetrievedLegalChunkForSynthesis,
} from "../legal/llm";

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
    text: "An employee is dismissed by his employer if the contract under which he is employed is terminated by the employer (whether with or without notice).",
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
    question: "Am I considered dismissed under ERA 1996 if my contract was terminated without notice?",
    facts: { dismissal_date: "2026-05-01" },
    retrievedChunks: chunks,
  };
}

// ---------------------------------------------------------------------
// modelRouter
// ---------------------------------------------------------------------

describe("modelRouter", () => {
  it("legal_drafting refuses when no retrieved chunks", () => {
    const r = routeModel({ task: "legal_drafting", hasRetrievedChunks: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("refused_no_citations");
  });

  it("legal_drafting routes to qwen when chunks present", () => {
    const r = routeModel({ task: "legal_drafting", hasRetrievedChunks: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.model).toBe("uk-employment-qwen:latest");
  });

  it("drafting_letter routes to drafting model and refuses without chunks", () => {
    expect(routeModel({ task: "drafting_letter", hasRetrievedChunks: false }).ok).toBe(false);
    const r = routeModel({ task: "drafting_letter", hasRetrievedChunks: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.model).toBe("uk-employment-drafting:latest");
  });

  it("document_summary routes to document model (no citation check needed)", () => {
    const r = routeModel({ task: "document_summary", hasRetrievedChunks: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.model).toBe("uk-employment-document:latest");
  });

  it("small_helper and classification reuse the strong local model", () => {
    for (const task of ["small_helper", "classification"] as const) {
      const r = routeModel({ task, hasRetrievedChunks: false });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.model).toBe("uk-employment-qwen:latest");
    }
  });

  it("router only emits local Ollama tags — never a public-provider model", () => {
    for (const task of ["legal_drafting", "drafting_letter", "document_summary", "small_helper", "classification"] as const) {
      const r = routeModel({ task, hasRetrievedChunks: true });
      if (r.ok) {
        expect(r.model).toMatch(/^uk-employment-(qwen|drafting|document):latest$/);
      }
    }
  });
});

// ---------------------------------------------------------------------
// citationBoundPrompt
// ---------------------------------------------------------------------

describe("citationBoundPrompt", () => {
  const baseChunk = makeChunk();

  it("emits exactly the supplied chunkIds in allowedCitationIds", () => {
    const r = buildCitationBoundPrompt({
      question: "test",
      retrievedChunks: [
        makeChunk({ chunkId: "a" }),
        makeChunk({ chunkId: "b" }),
        makeChunk({ chunkId: "c" }),
      ],
    });
    expect(r.allowedCitationIds).toEqual(["a", "b", "c"]);
  });

  it("includes only the supplied chunks in the user prompt", () => {
    const r = buildCitationBoundPrompt({
      question: "Q?",
      retrievedChunks: [baseChunk],
    });
    expect(r.userPrompt).toContain("[chunk_era_95]");
    expect(r.userPrompt).toContain("ERA 1996 s.95(1)");
    expect(r.userPrompt).toContain(baseChunk.url);
  });

  it("does NOT include unrelated chunks", () => {
    const r = buildCitationBoundPrompt({
      question: "Q?",
      retrievedChunks: [baseChunk],
    });
    expect(r.userPrompt).not.toContain("chunk_other_id");
    expect(r.userPrompt).not.toContain("legislation.gov.uk/ukpga/1996/19");
  });

  it("never includes secrets / DSNs / API keys in either prompt", () => {
    const r = buildCitationBoundPrompt({
      question: "Q?",
      retrievedChunks: [baseChunk],
    });
    const combined = r.systemPrompt + "\n" + r.userPrompt;
    expect(combined).not.toMatch(/postgres:\/\/[^\s]+:[^\s]+@/);
    expect(combined).not.toMatch(/DATABASE_URL\s*=/);
    expect(combined).not.toMatch(/github_pat_[A-Za-z0-9_]{20,}/);
    expect(combined).not.toMatch(/ghp_[A-Za-z0-9]{20,}/);
    expect(combined).not.toMatch(/sk-[A-Za-z0-9]{20,}/);
    expect(combined).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(combined).not.toMatch(/-----BEGIN/);
  });

  it("system prompt forbids hallucinated citations + invented sources", () => {
    const r = buildCitationBoundPrompt({
      question: "Q?",
      retrievedChunks: [baseChunk],
    });
    expect(r.systemPrompt).toMatch(/Cite by chunkId/);
    expect(r.systemPrompt).toMatch(/Do not invent statutes/);
    expect(r.systemPrompt).toMatch(/insufficient_sources/);
  });

  it("user prompt reports `(no sources supplied)` when chunks empty", () => {
    const r = buildCitationBoundPrompt({ question: "Q?", retrievedChunks: [] });
    expect(r.userPrompt).toContain("(no sources supplied)");
    expect(r.allowedCitationIds).toEqual([]);
  });

  it("includes the supplied jurisdiction + applicable_on date", () => {
    const r = buildCitationBoundPrompt({
      question: "Q?",
      retrievedChunks: [baseChunk],
      jurisdiction: "England and Wales",
      applicableOn: "2026-05-01",
    });
    expect(r.userPrompt).toContain("Jurisdiction: England and Wales");
    expect(r.userPrompt).toContain("Law as at: 2026-05-01");
  });
});

// ---------------------------------------------------------------------
// llmOutputGuard
// ---------------------------------------------------------------------

describe("llmOutputGuard", () => {
  const chunks = [makeChunk({ chunkId: "a" }), makeChunk({ chunkId: "b" })];

  function raw(overrides: Partial<LlmRawOutput> = {}): LlmRawOutput {
    return { answer: "Per [a], an employee is dismissed when ...", citedChunkIds: ["a"], ...overrides };
  }

  it("rejects empty answer", () => {
    const r = guardLlmOutput(raw({ answer: "" }), chunks);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("empty_answer");
  });

  it("rejects whitespace-only answer", () => {
    const r = guardLlmOutput(raw({ answer: "   \n  " }), chunks);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("empty_answer");
  });

  it("rejects zero citations", () => {
    const r = guardLlmOutput(raw({ citedChunkIds: [] }), chunks);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("zero_citations");
  });

  it("rejects hallucinated citation IDs (not in retrieved set)", () => {
    const r = guardLlmOutput(raw({ citedChunkIds: ["not_real"] }), chunks);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("hallucinated_citation");
  });

  it("rejects partially-hallucinated citation list (any bad id is a hard fail)", () => {
    const r = guardLlmOutput(raw({ citedChunkIds: ["a", "not_real"] }), chunks);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("hallucinated_citation");
  });

  it("accepts a citedChunkIds subset of the retrieved set", () => {
    const r = guardLlmOutput(raw({ citedChunkIds: ["a"] }), chunks);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.citations).toHaveLength(1);
      expect(r.citations[0]?.chunkId).toBe("a");
    }
  });

  it("citation metadata comes from the retrieved chunks, never from the model", () => {
    // Even if the model claims a different title/url, the guard takes the
    // retrieved chunk's values.
    const r = guardLlmOutput(
      raw({ citedChunkIds: ["a"] }),
      [makeChunk({ chunkId: "a", title: "TRUSTED TITLE", url: "https://trusted.example.test/a" })],
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.citations[0]?.title).toBe("TRUSTED TITLE");
      expect(r.citations[0]?.url).toBe("https://trusted.example.test/a");
    }
  });
});

// ---------------------------------------------------------------------
// runLocalDraftingStep (disabled-by-default integration)
// ---------------------------------------------------------------------

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

describe("runLocalDraftingStep — safety-first defaults", () => {
  it("empty retrieved chunks -> insufficient_sources (transport never reached)", async () => {
    const transport = makeMockTransport([]);
    const r = await runLocalDraftingStep(
      makeInput([]),
      makeGateway({ configured: true, available: true }),
      { transport },
    );
    expect(r.status).toBe("insufficient_sources");
    expect(transport.calls).toBe(0);
  });

  it("gateway unavailable -> llm_unavailable (transport never reached)", async () => {
    const transport = makeMockTransport([]);
    const r = await runLocalDraftingStep(
      makeInput([makeChunk()]),
      makeGateway(),
      { transport },
    );
    expect(r.status).toBe("llm_unavailable");
    expect(transport.calls).toBe(0);
  });

  it("gateway available but transport NOT injected -> llm_unavailable (mock-safe default)", async () => {
    const r = await runLocalDraftingStep(
      makeInput([makeChunk()]),
      makeGateway({ configured: true, available: true }),
    );
    expect(r.status).toBe("llm_unavailable");
  });

  it("transport returns timeout -> llm_unavailable", async () => {
    const transport = makeMockTransport([{ status: "timeout" }]);
    const r = await runLocalDraftingStep(
      makeInput([makeChunk()]),
      makeGateway({ configured: true, available: true }),
      { transport },
    );
    expect(r.status).toBe("llm_unavailable");
    expect(transport.calls).toBe(1);
    expect(r.safetyNotes.join(" ")).toMatch(/timeout/);
  });

  it("transport returns malformed -> llm_unavailable", async () => {
    const transport = makeMockTransport([{ status: "malformed" }]);
    const r = await runLocalDraftingStep(
      makeInput([makeChunk()]),
      makeGateway({ configured: true, available: true }),
      { transport },
    );
    expect(r.status).toBe("llm_unavailable");
    expect(r.safetyNotes.join(" ")).toMatch(/malformed/);
  });

  it("transport returns ok with valid citation -> synthesised", async () => {
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
      { transport },
    );
    expect(r.status).toBe("synthesised");
    expect(r.answer).toBeDefined();
    expect(r.citations).toHaveLength(1);
    expect(r.citations[0]?.citationLabel).toBe("ERA 1996 s.95(1)");
    expect(r.model).toBe("uk-employment-qwen:latest");
  });

  it("transport returns ok but cites a hallucinated id -> citation_failed", async () => {
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
      { transport },
    );
    expect(r.status).toBe("citation_failed");
    expect(r.answer).toBeUndefined();
  });

  it("transport returns ok with empty answer -> citation_failed (output guard)", async () => {
    const transport = makeMockTransport([
      {
        status: "ok",
        answer: "",
        citedChunkIds: ["chunk_era_95"],
        modelUsed: "uk-employment-qwen:latest",
        latencyMs: 100,
      },
    ]);
    const r = await runLocalDraftingStep(
      makeInput([makeChunk()]),
      makeGateway({ configured: true, available: true }),
      { transport },
    );
    expect(r.status).toBe("citation_failed");
  });
});

// ---------------------------------------------------------------------
// Static safety — no external SDK / URL / global fetch in legal/llm/
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

describe("Sprint 11 static safety — legal/llm/ surface", () => {
  const files = walkTs(LLM_DIR);

  it("no external provider hostname appears in legal/llm/", () => {
    const banned = /api\.openai\.com|anthropic\.com|generativelanguage\.googleapis\.com|api\.cohere\.com|api\.mistral\.ai/i;
    const offenders: string[] = [];
    for (const f of files) {
      const body = readFileSync(f, "utf8");
      const stripped = body
        .replace(/\/\/[^\n]*\n/g, "\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      if (banned.test(stripped)) offenders.push(f);
    }
    expect(offenders, `external provider URL in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("no external SDK import in legal/llm/", () => {
    const banned = /from\s+['"](openai|@anthropic-ai\/sdk|@google\/generative-ai|cohere-ai|@mistralai\/mistralai|node-fetch|undici|axios|got)['"]/;
    const offenders: string[] = [];
    for (const f of files) {
      const body = readFileSync(f, "utf8");
      const stripped = body
        .replace(/\/\/[^\n]*\n/g, "\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      if (banned.test(stripped)) offenders.push(f);
    }
    expect(offenders, `external SDK import in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("no top-level fetch( call in legal/llm/", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const body = readFileSync(f, "utf8");
      const stripped = body
        .replace(/\/\/[^\n]*\n/g, "\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      if (/\bfetch\s*\(/.test(stripped)) offenders.push(f);
    }
    expect(offenders, `fetch( in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("no DATABASE_URL or secret-shape literal in legal/llm/", () => {
    const banned = /DATABASE_URL\s*=|postgres:\/\/[^\s]+:[^\s]+@|github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{48,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|-----BEGIN/;
    const offenders: string[] = [];
    for (const f of files) {
      const body = readFileSync(f, "utf8");
      const stripped = body
        .replace(/\/\/[^\n]*\n/g, "\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      if (banned.test(stripped)) offenders.push(f);
    }
    expect(offenders, `secret-shape literal in: ${offenders.join(", ")}`).toEqual([]);
  });
});

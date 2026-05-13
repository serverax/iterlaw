// Sprint 15 — active-mode guard tests.
//
// Active mode is intentionally PARTIAL in this sprint — the wiring
// is in place but the intelligence result is discarded for now. The
// purpose of these tests is to PROVE that active mode is currently
// safe (it cannot bypass any existing legal-safety gate) and that
// the legacy answer path remains in charge.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleLegalRequest } from "../pipeline/handleLegalRequest";
import type { LegalRequest } from "../types/legal";
import type {
  OllamaTransport,
  OllamaTransportRequest,
  OllamaTransportResponse,
} from "../legal/llm/llm.types";
import type { RetrievalPort } from "../rag/retrieval.port";

function withActiveMode() {
  vi.stubEnv("ITERLAW_INTELLIGENCE_LAYER_ENABLED", "true");
  vi.stubEnv("ITERLAW_INTELLIGENCE_LAYER_MODE", "active");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

function baseReq(over: Partial<LegalRequest> = {}): LegalRequest {
  return {
    request_id: "active-req",
    user_id: "u1",
    workspace_id: "w1",
    mode: "ask",
    question: "Was I unfairly dismissed under ERA 1996?",
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

function chunkOk() {
  return {
    chunk_id: "chunk_era_94",
    document_id: "doc_era_1996",
    source_type: "legislation",
    authority_level: 100,
    title: "Employment Rights Act 1996 s.94",
    url: "https://www.legislation.gov.uk/ukpga/1996/18/section/94",
    citation_label: "ERA 1996 s.94",
    section_reference: "s.94",
    paragraph_reference: null as string | null,
    chunk_text: "An employee has the right not to be unfairly dismissed by his employer.",
    authority_level_value: 100,
    effective_date: null as string | null,
    applicable_to: null as string | null,
  };
}

function retrievalReturning(chunks: ReturnType<typeof chunkOk>[]): RetrievalPort {
  return {
    async search() {
      return {
        chunks: chunks as unknown as Parameters<RetrievalPort["search"]>[0] extends never ? never : never,
        retrieval_notes: [],
      } as unknown as Awaited<ReturnType<RetrievalPort["search"]>>;
    },
  };
}

describe("Sprint 15 — active mode safety guards", () => {
  beforeEach(() => {
    withActiveMode();
  });

  it("Test 1: active mode cannot produce a legal answer without citations", async () => {
    const transport: OllamaTransport & { send: ReturnType<typeof vi.fn> } = {
      send: vi.fn(async (_r: OllamaTransportRequest): Promise<OllamaTransportResponse> => ({
        status: "ok",
        answer: "uncited paragraph",
        citedChunkIds: [],
        modelUsed: "mock",
        latencyMs: 0,
      })),
    } as never;
    const r = await handleLegalRequest(baseReq(), {
      retrieval: retrievalReturning([chunkOk()]),
      transport,
      gateway: { configured: true, mode: "ollama", available: true },
    });
    expect(r.status).toBe("citation_failed");
    expect(r.citations).toEqual([]);
  });

  it("Test 2: active mode cannot bypass missing-facts response", async () => {
    const transport: OllamaTransport & { send: ReturnType<typeof vi.fn> } = {
      send: vi.fn(async (): Promise<OllamaTransportResponse> => ({ status: "ok" })),
    } as never;
    // No dismissal_date / suspension_date → existing pipeline produces
    // needs_more_facts.
    const r = await handleLegalRequest(
      baseReq({ facts: {}, question: "Can I claim unfair dismissal?" }),
      {
        retrieval: retrievalReturning([chunkOk()]),
        transport,
        gateway: { configured: true, mode: "ollama", available: true },
      },
    );
    expect(["needs_more_facts", "insufficient_sources"]).toContain(r.status);
    expect(r.external_llm_used).toBe(false);
  });

  it("Test 3: active mode external_llm_used always false", async () => {
    const transport: OllamaTransport & { send: ReturnType<typeof vi.fn> } = {
      send: vi.fn(async (): Promise<OllamaTransportResponse> => ({
        status: "ok",
        answer: "Per [chunk_era_94] …",
        citedChunkIds: ["chunk_era_94"],
        modelUsed: "mock",
        latencyMs: 0,
      })),
    } as never;
    const r = await handleLegalRequest(baseReq(), {
      retrieval: retrievalReturning([chunkOk()]),
      transport,
      gateway: { configured: true, mode: "ollama", available: true },
    });
    expect(r.external_llm_used).toBe(false);
  });

  it("Test 4: runtime source under intelligence/pipeline/config has no external network surface", async () => {
    // Sprint 12A: scan the runtime directories rather than a single
    // hardcoded file. Test files are excluded so the test does not
    // false-positive on its own forbidden-pattern literals. Comments
    // in runtime source are scanned too — operators must not leave
    // a literal forbidden token in runtime files even in a comment.
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join, dirname, resolve } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const here = dirname(fileURLToPath(import.meta.url));
    const repoRoot = resolve(here, "..", "..", "..", "..");

    const RUNTIME_DIRS = [
      join(repoRoot, "apps", "legal-orchestrator", "src", "intelligence"),
      join(repoRoot, "apps", "legal-orchestrator", "src", "pipeline"),
      join(repoRoot, "apps", "legal-orchestrator", "src", "config"),
    ];

    function listRuntimeFiles(dir: string): string[] {
      const out: string[] = [];
      const stack: string[] = [dir];
      while (stack.length > 0) {
        const d = stack.pop()!;
        let entries: string[];
        try {
          entries = readdirSync(d);
        } catch {
          continue;
        }
        for (const name of entries) {
          const p = join(d, name);
          let isDir = false;
          try {
            isDir = statSync(p).isDirectory();
          } catch {
            continue;
          }
          if (isDir) {
            // Exclude test directories outright.
            if (name === "tests" || name === "__tests__" || name === "node_modules" || name === "dist") continue;
            stack.push(p);
            continue;
          }
          // Files: include only TS / JS source; exclude .test.* and .spec.* files.
          if (!/\.(ts|tsx|js|mjs|cjs)$/.test(name)) continue;
          if (/\.(test|spec)\.(ts|tsx|js|mjs|cjs)$/.test(name)) continue;
          out.push(p);
        }
      }
      return out;
    }

    // Forbidden patterns that would indicate an external-network or
    // external-provider surface in runtime source.
    const FORBIDDEN: { name: string; re: RegExp }[] = [
      { name: "fetch(",          re: /\bfetch\s*\(/ },
      { name: "axios(",          re: /\baxios\s*\(/ },
      { name: "from 'axios'",    re: /from\s+["']axios["']/ },
      { name: "require('axios')",re: /require\s*\(\s*["']axios["']\s*\)/ },
      { name: "from 'openai'",   re: /from\s+["']openai["']/ },
      { name: "from '@anthropic-ai/sdk'", re: /from\s+["']@anthropic-ai\/sdk["']/ },
      { name: "from '@google/generative-ai'", re: /from\s+["']@google\/generative-ai["']/ },
      { name: "from 'cohere-ai'", re: /from\s+["']cohere-ai["']/ },
      { name: "from '@mistralai/...'", re: /from\s+["']@mistralai\// },
      { name: "new OpenAI(",      re: /\bnew\s+OpenAI\s*\(/ },
      { name: "new Anthropic(",   re: /\bnew\s+Anthropic\s*\(/ },
    ];

    const files: string[] = [];
    for (const d of RUNTIME_DIRS) {
      for (const f of listRuntimeFiles(d)) files.push(f);
    }
    expect(files.length, "runtime files must exist to scan").toBeGreaterThan(0);

    const violations: string[] = [];
    for (const f of files) {
      let body: string;
      try {
        body = readFileSync(f, "utf8");
      } catch {
        continue;
      }
      for (const rule of FORBIDDEN) {
        if (rule.re.test(body)) {
          violations.push(`${rule.name} in ${f}`);
        }
      }
    }
    expect(violations, violations.join(" ; ")).toEqual([]);
  });

  it("Test 5: active mode falls back safely when intelligence gateway is called with empty chunks", async () => {
    const transport: OllamaTransport & { send: ReturnType<typeof vi.fn> } = {
      send: vi.fn(async (): Promise<OllamaTransportResponse> => ({ status: "ok" })),
    } as never;
    const r = await handleLegalRequest(baseReq(), {
      retrieval: emptyRetrieval(),
      transport,
      gateway: { configured: true, mode: "ollama", available: true },
    });
    expect([
      "insufficient_sources",
      "needs_more_facts",
      "high_risk_deadline",
      "citation_failed",
      "policy_failed",
    ]).toContain(r.status);
  });

  it("Test 6: active mode respects existing RAG insufficiency behaviour", async () => {
    const transport: OllamaTransport & { send: ReturnType<typeof vi.fn> } = {
      send: vi.fn(async (): Promise<OllamaTransportResponse> => ({ status: "ok" })),
    } as never;
    const r = await handleLegalRequest(baseReq(), {
      retrieval: emptyRetrieval(),
      transport,
      gateway: { configured: true, mode: "ollama", available: true },
    });
    expect(transport.send).not.toHaveBeenCalled();
    expect(r.external_llm_used).toBe(false);
  });
});

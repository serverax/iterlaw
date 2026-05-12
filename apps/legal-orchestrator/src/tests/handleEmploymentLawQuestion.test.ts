import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { handleEmploymentLawQuestion } from "../legal/orchestrator/handleEmploymentLawQuestion";
import {
  createRagRun,
  getRagRunById,
  updateRagRunStatus,
  type DbClient,
} from "../legal/repositories/ragRunRepository";
import {
  checkOllamaHealth,
  getOllamaBaseUrl,
  listLocalModels,
  DEFAULT_OLLAMA_BASE_URL,
} from "../legal/llm/localOllamaGateway";
import { officialLegalSourcesSeed } from "../legal/seeds/officialSources.seed";
import { TypeScriptLegalRulesEngine } from "../legal/types/legalRules.types";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------
// handleEmploymentLawQuestion — Master-Order envelope shape.
// ---------------------------------------------------------------------

describe("handleEmploymentLawQuestion", () => {
  it("returns insufficient_sources with NO fake citations and NO model call", async () => {
    const r = await handleEmploymentLawQuestion({
      question: "Am I in time to bring an unfair dismissal claim?",
    });
    expect(r.answerStatus).toBe("insufficient_sources");
    expect(r.citations).toEqual([]);
    expect(r.practicalSteps).toEqual([]);
    expect(r.deadlines).toEqual([]);
    expect(r.riskFlags).toEqual([]);
    expect(r.confidenceScore).toBe(0);
    expect(r.sourceQualityScore).toBe(0);
    expect(r.ragRunId).toBeUndefined(); // no DbClient supplied
    expect(r.summary).toMatch(/retrieval and verified source answering are not wired yet/);
  });

  it("persists a rag_runs row when a DbClient is supplied", async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    const fakeId = "11111111-1111-4111-8111-111111111111";
    const db: DbClient = {
      async query(sql, params) {
        calls.push({ sql, params });
        return { rows: [{ id: fakeId }], rowCount: 1 };
      },
    };
    const r = await handleEmploymentLawQuestion(
      { question: "What is the limitation period for unfair dismissal?" },
      { db }
    );
    expect(r.ragRunId).toBe(fakeId);
    expect(calls.length).toBe(1);
    expect(calls[0]!.sql).toMatch(/INSERT INTO rag_runs/);
    // user input is bound via $1, never interpolated.
    expect(calls[0]!.sql).not.toMatch(/unfair dismissal/);
    expect(calls[0]!.params).toContain("What is the limitation period for unfair dismissal?");
  });
});

// ---------------------------------------------------------------------
// ragRunRepository — validation + DB_NOT_WIRED behaviour.
// ---------------------------------------------------------------------

describe("ragRunRepository", () => {
  it("returns DB_NOT_WIRED when no client is provided", async () => {
    const c = await createRagRun(null, { userQuestion: "x" });
    expect(c.status).toBe("DB_NOT_WIRED");
    const u = await updateRagRunStatus(null, {
      id: "11111111-1111-4111-8111-111111111111",
      answerStatus: "insufficient_sources",
    });
    expect(u.status).toBe("DB_NOT_WIRED");
    const g = await getRagRunById(null, "11111111-1111-4111-8111-111111111111");
    expect(g.status).toBe("DB_NOT_WIRED");
  });

  it("validates the user question is non-empty", async () => {
    const r = await createRagRun(null, { userQuestion: "" });
    expect(r.status).toBe("validation_error");
    if (r.status === "validation_error") expect(r.code).toBe("invalid_user_question");
  });

  it("rejects an invalid UUID on update", async () => {
    const r = await updateRagRunStatus(null, {
      id: "not-a-uuid",
      answerStatus: "insufficient_sources",
    });
    expect(r.status).toBe("validation_error");
  });

  it("rejects an unknown answerStatus", async () => {
    const r = await updateRagRunStatus(null, {
      id: "11111111-1111-4111-8111-111111111111",
      answerStatus: "bogus" as never,
    });
    expect(r.status).toBe("validation_error");
  });

  it("builds parameterised SQL — no raw user input interpolation", async () => {
    const evil = "x'); DROP TABLE rag_runs; --";
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    const db: DbClient = {
      async query(sql, params) {
        calls.push({ sql, params });
        return { rows: [{ id: "11111111-1111-4111-8111-111111111111" }], rowCount: 1 };
      },
    };
    await createRagRun(db, { userQuestion: evil });
    expect(calls[0]!.sql).not.toContain("DROP TABLE");
    expect(calls[0]!.sql).not.toContain(evil);
    expect(calls[0]!.params).toContain(evil);
  });
});

// ---------------------------------------------------------------------
// localOllamaGateway — health probe never lies.
// ---------------------------------------------------------------------

describe("localOllamaGateway", () => {
  it("defaults to the Master-Order endpoint when OLLAMA_BASE_URL is unset", () => {
    const prior = process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_BASE_URL;
    try {
      expect(getOllamaBaseUrl()).toBe(DEFAULT_OLLAMA_BASE_URL);
      expect(DEFAULT_OLLAMA_BASE_URL).toBe(
        "http://ollama.ordinox-ai.svc.cluster.local:11434"
      );
    } finally {
      if (typeof prior === "string") process.env.OLLAMA_BASE_URL = prior;
    }
  });

  it("returns OLLAMA_UNAVAILABLE when EXTERNAL_LLM_ENABLED=true (defence-in-depth)", async () => {
    const priorExt = process.env.EXTERNAL_LLM_ENABLED;
    process.env.EXTERNAL_LLM_ENABLED = "true";
    try {
      const h = await checkOllamaHealth();
      expect(h.status).toBe("OLLAMA_UNAVAILABLE");
      if (h.status === "OLLAMA_UNAVAILABLE") {
        expect(h.reason).toBe("external_llm_enabled_true_is_forbidden");
      }
      const m = await listLocalModels();
      expect(m.status).toBe("OLLAMA_UNAVAILABLE");
    } finally {
      if (typeof priorExt === "string") process.env.EXTERNAL_LLM_ENABLED = priorExt;
      else delete process.env.EXTERNAL_LLM_ENABLED;
    }
  });

  it("returns OLLAMA_UNAVAILABLE when the endpoint is unreachable (no real network call)", async () => {
    // Force the gateway to consult an obviously-invalid base URL with
    // a tight timeout so we exercise the error branch deterministically.
    const h = await checkOllamaHealth({
      baseUrl: "http://127.0.0.1:1",
      timeoutMs: 50,
    });
    expect(h.status).toBe("OLLAMA_UNAVAILABLE");
  });
});

// ---------------------------------------------------------------------
// Seed + rules engine + static safety.
// ---------------------------------------------------------------------

describe("officialLegalSourcesSeed", () => {
  it("contains exactly the six Master-Order sources", () => {
    const names = officialLegalSourcesSeed.map((s) => s.sourceType).sort();
    expect(names).toEqual(["acas", "case_law", "ehrc", "govuk", "hmcts", "legislation"]);
  });

  it("flags every source as official and HTTPS-only", () => {
    for (const s of officialLegalSourcesSeed) {
      expect(s.isOfficial).toBe(true);
      expect(s.sourceUrl.startsWith("https://"), s.sourceName).toBe(true);
    }
  });
});

describe("TypeScriptLegalRulesEngine placeholder", () => {
  it("returns not_implemented for every method (WASM swap-in pending)", async () => {
    const e = new TypeScriptLegalRulesEngine();
    for (const m of ["checkDeadlineRisk", "rankSources", "verifyCitations", "calculateRemedy"] as const) {
      const r = (await e[m]({})) as { status: string; check: string };
      expect(r.status).toBe("not_implemented");
      expect(r.check).toBe(m);
    }
  });
});

describe("Master-Order code static safety", () => {
  const ORCH = readFileSync(
    join(__dirname, "../legal/orchestrator/handleEmploymentLawQuestion.ts"),
    "utf8"
  );
  const GATE = readFileSync(
    join(__dirname, "../legal/llm/localOllamaGateway.ts"),
    "utf8"
  );
  const REPO = readFileSync(
    join(__dirname, "../legal/repositories/ragRunRepository.ts"),
    "utf8"
  );
  const stripComments = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

  it("orchestrator never imports an LLM client or invents citations", () => {
    const s = stripComments(ORCH);
    expect(s).not.toMatch(/\bfrom\s+["'](openai|@anthropic-ai\/sdk|ollama|anthropic)["']/);
    expect(s).not.toMatch(/\bfetch\s*\(/);
    // The skeleton must not synthesise a `citations` array in its
    // return — the test on line ~40 of this file confirms `citations:
    // []` at runtime; this check is the static guarantee.
    expect(s).not.toMatch(/citations:\s*\[\s*\{/);
  });

  it("ollama gateway honours the EXTERNAL_LLM_ENABLED guard", () => {
    expect(GATE).toMatch(/EXTERNAL_LLM_ENABLED/);
    expect(GATE).toMatch(/OLLAMA_UNAVAILABLE/);
  });

  it("ragRunRepository never embeds caller text into SQL", () => {
    const s = stripComments(REPO);
    expect(s).not.toMatch(/`\$\{.*input.*\}`/);
    expect(s).not.toMatch(/`\$\{.*question.*\}`/);
  });
});

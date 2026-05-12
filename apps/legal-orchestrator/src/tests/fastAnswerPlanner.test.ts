import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { planFastLegalAnswer } from "../intelligence/fastAnswerPlanner";
import type {
  FastAnswerInput,
  LegalAnswerBlock,
  LegalResponseCacheEntry,
} from "../intelligence/fastAnswer.types";

const __dirname = dirname(fileURLToPath(import.meta.url));

function base(over: Partial<FastAnswerInput> = {}): FastAnswerInput {
  return {
    request_id: "req-test-1",
    legal_pack: "uk_employment_england_wales",
    question_mode: "ask",
    question_fingerprint: "qfp-abc",
    facts_fingerprint: "ffp-abc",
    classification: {
      area_of_law: "unfair_dismissal",
      jurisdiction: "England and Wales",
      requires_deadline_check: true,
      requires_citations: true,
      complexity_score: 0.3,
    },
    facts: { dismissal_date: "2026-04-01", acas_started: true },
    risk: { status: "ok", risk_level: "low", missing_facts: [] },
    ...over,
  };
}

const SAMPLE_CACHE: LegalResponseCacheEntry = {
  id: "cache-12345678",
  fingerprint: "fp-1",
  legal_pack: "uk_employment_england_wales",
  jurisdiction: "England and Wales",
  answer_text: "(cached)",
  cited_chunk_ids: ["chunk-a", "chunk-b"],
  created_at: "2026-05-01T00:00:00Z",
  expires_at: "2026-06-01T00:00:00Z",
};

const SAMPLE_BLOCK: LegalAnswerBlock = {
  id: "block-1",
  scenario_key: "unfair_dismissal_overview",
  area_of_law: "unfair_dismissal",
  jurisdiction: "England and Wales",
  template_text: "(prepared answer)",
  cited_chunk_ids: ["chunk-a"],
};

// ---------------------------------------------------------------------
// Cache & prepared answer preference.
// ---------------------------------------------------------------------

describe("planFastLegalAnswer — cache and prepared answer routing", () => {
  it("uses the cache when a cache_hit is supplied (preferred over LLM)", () => {
    const r = planFastLegalAnswer(base({ cache_hit: SAMPLE_CACHE }));
    expect(r.decision.mode).toBe("instant_prepared");
    expect(r.decision.synthesis_required).toBe(false);
    expect(r.answer_source?.kind).toBe("cache");
    if (r.answer_source?.kind === "cache") {
      expect(r.answer_source.cache_id).toBe(SAMPLE_CACHE.id);
    }
    expect(r.decision.reason).toMatch(/cache_hit/);
  });

  it("uses a prepared answer block when no cache exists but a block matches", () => {
    const r = planFastLegalAnswer(base({ prepared_block: SAMPLE_BLOCK }));
    expect(r.decision.mode).toBe("instant_prepared");
    expect(r.decision.synthesis_required).toBe(false);
    expect(r.answer_source?.kind).toBe("prepared_block");
    if (r.answer_source?.kind === "prepared_block") {
      expect(r.answer_source.scenario_key).toBe(SAMPLE_BLOCK.scenario_key);
    }
    expect(r.decision.reason).toMatch(/prepared_block/);
  });

  it("cache takes priority over a prepared block when both are present", () => {
    const r = planFastLegalAnswer(
      base({ cache_hit: SAMPLE_CACHE, prepared_block: SAMPLE_BLOCK })
    );
    expect(r.answer_source?.kind).toBe("cache");
  });
});

// ---------------------------------------------------------------------
// Missing facts.
// ---------------------------------------------------------------------

describe("planFastLegalAnswer — missing facts", () => {
  it("returns missing_facts when classification has no jurisdiction", () => {
    const r = planFastLegalAnswer(
      base({
        classification: {
          area_of_law: "unfair_dismissal",
          jurisdiction: "",
          requires_deadline_check: true,
          requires_citations: true,
        },
      })
    );
    expect(r.decision.mode).toBe("missing_facts");
    expect(r.missing_facts).toContain("jurisdiction");
    expect(r.decision.synthesis_required).toBe(false);
  });

  it("propagates risk.missing_facts when the risk check needs more facts", () => {
    const r = planFastLegalAnswer(
      base({
        risk: {
          status: "needs_more_facts",
          risk_level: "unknown",
          missing_facts: ["dismissal_date"],
        },
      })
    );
    expect(r.decision.mode).toBe("missing_facts");
    expect(r.missing_facts).toEqual(["dismissal_date"]);
  });

  it("flags area-specific required facts (unfair_dismissal needs dismissal_date)", () => {
    const r = planFastLegalAnswer(
      base({
        facts: { acas_started: true },
      })
    );
    expect(r.decision.mode).toBe("missing_facts");
    expect(r.missing_facts).toContain("dismissal_date");
  });
});

// ---------------------------------------------------------------------
// Urgent deadline.
// ---------------------------------------------------------------------

describe("planFastLegalAnswer — high-risk deadline triggers urgent deep analysis", () => {
  it("routes high_risk_deadline to deep_analysis with high/urgent priority", () => {
    const r = planFastLegalAnswer(
      base({
        risk: { status: "high_risk_deadline", risk_level: "high", missing_facts: [] },
      })
    );
    expect(r.decision.mode).toBe("deep_analysis");
    expect(r.decision.synthesis_required).toBe(true);
    expect(r.decision.llm_job?.role).toBe("heavy_reasoning");
    expect(["high", "urgent"]).toContain(r.decision.llm_job?.priority);
  });

  it("escalates to urgent when risk_level is critical", () => {
    const r = planFastLegalAnswer(
      base({
        risk: { status: "high_risk_deadline", risk_level: "critical", missing_facts: [] },
      })
    );
    expect(r.decision.llm_job?.priority).toBe("urgent");
  });
});

// ---------------------------------------------------------------------
// LLM job for complex document review.
// ---------------------------------------------------------------------

describe("planFastLegalAnswer — document review", () => {
  it("creates a deep_analysis LLM job decision for document_review mode", () => {
    const r = planFastLegalAnswer(base({ question_mode: "document_review" }));
    expect(r.decision.mode).toBe("deep_analysis");
    expect(r.decision.synthesis_required).toBe(true);
    expect(r.decision.llm_job?.role).toBe("heavy_reasoning");
    expect(r.decision.routing?.role).toBe("heavy_reasoning");
  });
});

// ---------------------------------------------------------------------
// RAG default path.
// ---------------------------------------------------------------------

describe("planFastLegalAnswer — RAG and LLM composition", () => {
  it("uses rag_grounded when no prepared answer exists and chunks are expected", () => {
    const r = planFastLegalAnswer(base());
    expect(r.decision.mode).toBe("rag_grounded");
    expect(r.decision.synthesis_required).toBe(true);
    expect(r.decision.llm_job?.role).toBe("uk_employment_qa");
  });

  it("falls back to llm_composed when rag is not expected to return chunks", () => {
    const r = planFastLegalAnswer(base({ rag_expected_to_return_chunks: false }));
    expect(r.decision.mode).toBe("llm_composed");
    expect(r.decision.llm_job?.role).toBe("uk_employment_qa");
    expect(r.decision.reason).toMatch(/rag_unavailable/);
  });

  it("routes drafting mode to the drafting role (llm_composed)", () => {
    const r = planFastLegalAnswer(
      base({ question_mode: "draft" })
    );
    expect(r.decision.mode).toBe("llm_composed");
    expect(r.decision.llm_job?.role).toBe("uk_employment_drafting");
    expect(r.decision.routing?.max_tokens).toBe(2000);
  });
});

// ---------------------------------------------------------------------
// Deep analysis only on high complexity.
// ---------------------------------------------------------------------

describe("planFastLegalAnswer — deep analysis only when complexity is high", () => {
  it("does NOT escalate to deep_analysis at complexity 0.3", () => {
    const r = planFastLegalAnswer(
      base({ classification: { ...base().classification, complexity_score: 0.3 } })
    );
    expect(r.decision.mode).not.toBe("deep_analysis");
  });

  it("escalates to deep_analysis at complexity 0.7 (threshold)", () => {
    const r = planFastLegalAnswer(
      base({ classification: { ...base().classification, complexity_score: 0.7 } })
    );
    expect(r.decision.mode).toBe("deep_analysis");
    expect(r.decision.llm_job?.role).toBe("heavy_reasoning");
  });

  it("escalates to deep_analysis at complexity 0.95", () => {
    const r = planFastLegalAnswer(
      base({ classification: { ...base().classification, complexity_score: 0.95 } })
    );
    expect(r.decision.mode).toBe("deep_analysis");
  });
});

// ---------------------------------------------------------------------
// Determinism, explainability, no side effects.
// ---------------------------------------------------------------------

describe("planFastLegalAnswer — determinism and audit-safety", () => {
  it("is pure — same input produces same output", () => {
    const a = planFastLegalAnswer(base());
    const b = planFastLegalAnswer(base());
    expect(a).toEqual(b);
  });

  it("attaches an explainable routing reason to every decision", () => {
    const inputs: FastAnswerInput[] = [
      base(),
      base({ cache_hit: SAMPLE_CACHE }),
      base({ prepared_block: SAMPLE_BLOCK }),
      base({ question_mode: "draft" }),
      base({ question_mode: "document_review" }),
      base({ risk: { status: "high_risk_deadline", risk_level: "high", missing_facts: [] } }),
      base({ risk: { status: "needs_more_facts", risk_level: "unknown", missing_facts: ["x"] } }),
      base({ rag_expected_to_return_chunks: false }),
    ];
    for (const inp of inputs) {
      const r = planFastLegalAnswer(inp);
      expect(typeof r.decision.reason).toBe("string");
      expect(r.decision.reason.length).toBeGreaterThan(3);
    }
  });

  it("always echoes the request_id back", () => {
    const r = planFastLegalAnswer(base({ request_id: "req-echo-42" }));
    expect(r.request_id).toBe("req-echo-42");
  });

  it("never sets synthesis_required=true for instant_prepared or missing_facts", () => {
    const a = planFastLegalAnswer(base({ cache_hit: SAMPLE_CACHE }));
    const b = planFastLegalAnswer(base({ prepared_block: SAMPLE_BLOCK }));
    const c = planFastLegalAnswer(
      base({
        classification: { ...base().classification, jurisdiction: "" },
      })
    );
    expect(a.decision.synthesis_required).toBe(false);
    expect(b.decision.synthesis_required).toBe(false);
    expect(c.decision.synthesis_required).toBe(false);
  });
});

// ---------------------------------------------------------------------
// Static safety: planner source has no I/O imports or env reads.
// ---------------------------------------------------------------------

describe("planFastLegalAnswer — static safety guarantees", () => {
  const plannerSrcRaw = readFileSync(
    join(__dirname, "../intelligence/fastAnswerPlanner.ts"),
    "utf8"
  );
  // Strip line and block comments before scanning so the rule-describing
  // header comment ("no process.env, no Math.random") isn't itself
  // flagged as a violation.
  const plannerSrc = plannerSrcRaw
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

  it("does not import a Postgres driver, fetch, axios, or LLM client", () => {
    const banned = [
      /\bfrom\s+["']pg["']/,
      /\brequire\(\s*["']pg["']/,
      /\bfrom\s+["']node-fetch["']/,
      /\baxios\b/,
      /\bfetch\s*\(/,
      /\bopenai\b/i,
      /\bollama\b/i,
      /\banthropic\b/i,
    ];
    for (const re of banned) {
      expect(plannerSrc, `unexpected match for ${re}`).not.toMatch(re);
    }
  });

  it("contains no process.env reads, Math.random calls, or Date.now reads (excluding comments)", () => {
    expect(plannerSrc).not.toMatch(/\bprocess\.env\b/);
    expect(plannerSrc).not.toMatch(/\bMath\.random\b/);
    expect(plannerSrc).not.toMatch(/\bDate\.now\b/);
    expect(plannerSrc).not.toMatch(/\bnew\s+Date\s*\(/);
  });
});

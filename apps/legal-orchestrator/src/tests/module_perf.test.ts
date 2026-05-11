// Performance budget: every module must respond in < 50ms for normal
// payloads. Tested as a single suite so a regression in any module is
// caught in one place.

import { describe, it, expect } from "vitest";
import { deadlineChecker } from "../modules/deadlineChecker";
import { citationVerifier } from "../modules/citationVerifier";
import { policyGateModule } from "../modules/policyGate";
import { sourceRanker } from "../modules/sourceRanker";
import { piiRedactor } from "../modules/piiRedactor";
import { ruleEngine } from "../modules/ruleEngine";
import { UK_EMPLOYMENT_CONTEXT } from "../modules/index";
import type { RetrievedChunk, SourceRankerResult } from "../modules/contracts";

const BUDGET_MS = 50;

function measure(fn: () => unknown): number {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
}

describe("module perf budgets (<50ms)", () => {
  it("deadlineChecker < 50ms", () => {
    const ms = measure(() =>
      deadlineChecker(
        {
          jurisdiction: "uk_ew",
          area_of_law: "unfair_dismissal",
          facts: {
            employment_start_date: "2018-01-01",
            dismissal_date: "2026-04-01",
            acas_started: false,
          },
          now_iso: "2026-04-15",
        },
        UK_EMPLOYMENT_CONTEXT
      )
    );
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it("ruleEngine < 50ms", () => {
    const ms = measure(() =>
      ruleEngine(
        {
          area_of_law: "unfair_dismissal",
          facts: { dismissal_date: "2026-04-01", acas_started: false },
        },
        UK_EMPLOYMENT_CONTEXT
      )
    );
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it("citationVerifier < 50ms with 20 chunks + 5 citations", () => {
    const chunks: RetrievedChunk[] = Array.from({ length: 20 }, (_, i) => ({
      chunk_id: `c${i}`,
      source_type: i % 2 ? "acas_guidance" : "legislation",
      citation_label: `cite-${i}`,
      chunk_text: "Some legal text containing words and references. ".repeat(10),
      authority_level: i % 2 ? 60 : 100,
    }));
    const citations = chunks.slice(0, 5).map((c) => ({
      chunk_id: c.chunk_id,
      quote_text: "containing words",
    }));
    const ms = measure(() =>
      citationVerifier({
        answer_text: "An analysis grounded in the supplied sources.",
        citations,
        retrieved_chunks: chunks,
      })
    );
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it("policyGateModule < 50ms on a long answer", () => {
    const long = "Subject to ACAS Early Conciliation and the 3 months less one day limitation, the claimant should consult a qualified solicitor. ".repeat(50);
    const ms = measure(() =>
      policyGateModule(
        {
          answer_text: long,
          classification: { area_of_law: "unfair_dismissal", requires_deadline_check: true },
          risk_check: { status: "ok", risk_level: "low" },
          has_citations: true,
        },
        UK_EMPLOYMENT_CONTEXT
      )
    );
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it("sourceRanker < 50ms with 50 results", () => {
    const results: SourceRankerResult[] = Array.from({ length: 50 }, (_, i) => ({
      chunk_id: `r${i}`,
      authority_level: 50 + (i % 50),
      source_type: i % 3 === 0 ? "legislation" : i % 3 === 1 ? "acas_guidance" : "gov_guidance",
      title: `Source ${i}`,
      chunk_text: "An employee is dismissed under the Employment Rights Act when the contract is terminated. ".repeat(5),
      effective_date: `2020-0${(i % 9) + 1}-01`,
    }));
    const ms = measure(() => sourceRanker({ query: "employee dismissed contract", results }));
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it("piiRedactor < 50ms on a 5 KB document with mixed PII", () => {
    const block = "Contact jane.doe@example.co.uk at +44 7700 900123 with NI QQ123456C from SW1A 1AA. ";
    const text = block.repeat(60); // ~5 KB
    const ms = measure(() => piiRedactor({ text }));
    expect(ms).toBeLessThan(BUDGET_MS);
  });
});

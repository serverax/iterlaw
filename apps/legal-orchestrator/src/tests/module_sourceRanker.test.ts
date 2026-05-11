import { describe, it, expect } from "vitest";
import { sourceRanker } from "../modules/sourceRanker";
import type { SourceRankerResult } from "../modules/contracts";

const items: SourceRankerResult[] = [
  {
    chunk_id: "a-acas",
    authority_level: 60,
    source_type: "acas_guidance",
    title: "ACAS Code of Practice on Disciplinary and Grievance Procedures",
    chunk_text:
      "Suspension should be a neutral act and used only when there is reasonable and proper cause.",
    effective_date: "2015-03-11",
  },
  {
    chunk_id: "b-era",
    authority_level: 100,
    source_type: "legislation",
    title: "Employment Rights Act 1996 Section 95",
    chunk_text:
      "Circumstances in which an employee is dismissed. An employee is dismissed when the contract is terminated.",
    effective_date: "1996-05-22",
  },
  {
    chunk_id: "c-govuk",
    authority_level: 50,
    source_type: "gov_guidance",
    title: "Dismissals: an overview",
    chunk_text: "An employer must follow a fair procedure when dismissing an employee.",
    effective_date: "2024-04-06",
  },
];

describe("sourceRanker", () => {
  it("returns the same number of results", () => {
    const r = sourceRanker({ query: "Can I be dismissed?", results: items });
    expect(r.ranked_results.length).toBe(items.length);
  });

  it("ranks statute above guidance when relevance is similar", () => {
    const r = sourceRanker({ query: "dismissal contract terminated", results: items });
    // ERA (legislation, authority 100) should win.
    expect(r.ranked_results[0].chunk_id).toBe("b-era");
  });

  it("ranks ACAS above GOV.UK on a suspension query (relevance + authority)", () => {
    const r = sourceRanker({
      query: "suspension neutral act reasonable cause",
      results: items,
    });
    expect(r.ranked_results[0].chunk_id).toBe("a-acas");
  });

  it("never returns negative or >1 scores", () => {
    const r = sourceRanker({ query: "anything", results: items });
    for (const x of r.ranked_results) {
      expect(x.ranker_score).toBeGreaterThanOrEqual(0);
      expect(x.ranker_score).toBeLessThanOrEqual(1);
    }
  });

  it("is stable: same input → same order", () => {
    const r1 = sourceRanker({ query: "dismissal", results: items });
    const r2 = sourceRanker({ query: "dismissal", results: items });
    expect(r2.ranked_results.map((x) => x.chunk_id)).toEqual(
      r1.ranked_results.map((x) => x.chunk_id)
    );
  });
});

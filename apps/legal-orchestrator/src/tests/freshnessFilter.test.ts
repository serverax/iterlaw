// Sprint 14 — freshness filter tests.

import { describe, expect, it } from "vitest";
import {
  assessFreshness,
  filterFreshForLegalAnswer,
} from "../intelligence/freshnessFilter";
import type { RetrievalCandidate } from "../intelligence/intelligence.types";

function cand(over: Partial<RetrievalCandidate>): RetrievalCandidate {
  return {
    candidate_id: over.candidate_id ?? "c",
    source_type: over.source_type ?? "statutory_source",
    source_id: "s",
    source_title: null,
    source_url: null,
    text: "t",
    effective_from: over.effective_from ?? "2020-01-01",
    effective_to: over.effective_to ?? null,
    last_verified_at: over.last_verified_at ?? "2026-01-01",
    superseded_by: over.superseded_by ?? null,
    qa_status: "approved",
    authority_level: null,
    keyword_rank: null,
    vector_rank: null,
    reason_codes: [],
    ...over,
  };
}

describe("Sprint 14 — freshness assess", () => {
  it("marks fresh when within effective window", () => {
    const a = assessFreshness([cand({})], { now_utc: "2026-05-13T00:00:00Z" });
    expect(a[0].status).toBe("fresh");
  });

  it("marks stale when effective_to has passed", () => {
    const a = assessFreshness(
      [cand({ effective_to: "2024-01-01" })],
      { now_utc: "2026-05-13T00:00:00Z" },
    );
    expect(a[0].status).toBe("stale_effective_to_passed");
  });

  it("marks stale when superseded_by present", () => {
    const a = assessFreshness([cand({ superseded_by: "newer-id" })]);
    expect(a[0].status).toBe("stale_superseded");
  });

  it("marks needs_review when legal source has no effective dates", () => {
    const a = assessFreshness([
      cand({ effective_from: null, effective_to: null, source_type: "statutory_source" }),
    ]);
    expect(a[0].status).toBe("needs_review_missing_dates");
  });

  it("marks needs_review when legal source lacks last_verified_at", () => {
    const a = assessFreshness([
      cand({ source_type: "govuk_guidance", last_verified_at: null }),
    ]);
    expect(a[0].status).toBe("needs_review_no_last_verified");
  });

  it("allow_historical overrides stale to historical_only", () => {
    const a = assessFreshness(
      [cand({ effective_to: "2010-01-01" })],
      { now_utc: "2026-05-13T00:00:00Z", allow_historical: true },
    );
    expect(a[0].status).toBe("historical_only");
  });
});

describe("Sprint 14 — filterFreshForLegalAnswer", () => {
  it("keeps fresh, removes stale, keeps review-needed", () => {
    const fresh = cand({ candidate_id: "ok" });
    const stale = cand({ candidate_id: "old", effective_to: "2010-01-01" });
    const review = cand({
      candidate_id: "rv",
      source_type: "statutory_source",
      effective_from: null,
      effective_to: null,
    });
    const a = assessFreshness([fresh, stale, review], { now_utc: "2026-05-13T00:00:00Z" });
    const r = filterFreshForLegalAnswer([fresh, stale, review], a);
    expect(r.kept.map((c) => c.candidate_id).sort()).toEqual(["ok", "rv"]);
    expect(r.removed.map((c) => c.candidate_id)).toEqual(["old"]);
  });

  it("kept_for_review reason code emitted for review-needed material", () => {
    const review = cand({
      candidate_id: "rv",
      source_type: "statutory_source",
      effective_from: null,
      effective_to: null,
    });
    const a = assessFreshness([review]);
    const r = filterFreshForLegalAnswer([review], a);
    expect(r.reason_codes.some((s) => s.startsWith("kept_for_review:rv"))).toBe(true);
  });
});

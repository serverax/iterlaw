import { describe, expect, it } from "vitest";

import {
  buildRetrievalCacheKey,
  normaliseQuestion,
  runApprovedAnswerFastPath,
} from "../retrieval";
import type {
  ApprovedAnswerEntry,
  ApprovedAnswerLookup,
} from "../retrieval";

const BASE_KEY_INPUT = {
  workspaceId: "ws-1",
  projectId: "p-1",
  moduleId: "uk_employment",
  jurisdiction: "UK_ENGLAND_WALES",
  lawArea: "employment",
  question: "What is the qualifying service for unfair dismissal?",
  contextSourceHash: "ctx-2026-05-14-snapshot-A",
};

const NOW = "2026-05-14";

function mkEntry(overrides: Partial<ApprovedAnswerEntry>): ApprovedAnswerEntry {
  return {
    cacheKey: "k",
    answerText: "An employee normally needs 2 years' continuous service.",
    citationCount: 2,
    qaStatus: "approved",
    lastVerifiedAt: "2026-04-01",
    expiresAt: "2027-01-01",
    ...overrides,
  };
}

describe("normaliseQuestion", () => {
  it("lowercases and trims whitespace + punctuation", () => {
    expect(normaliseQuestion("  Was the dismissal UNFAIR?? ")).toBe("was the dismissal unfair");
  });

  it("collapses internal whitespace", () => {
    expect(normaliseQuestion("a    b   c")).toBe("a b c");
  });

  it("returns empty string for non-strings", () => {
    expect(normaliseQuestion(undefined as unknown as string)).toBe("");
  });
});

describe("buildRetrievalCacheKey", () => {
  it("is deterministic for the same inputs", () => {
    const a = buildRetrievalCacheKey(BASE_KEY_INPUT);
    const b = buildRetrievalCacheKey(BASE_KEY_INPUT);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when the workspace changes", () => {
    const a = buildRetrievalCacheKey(BASE_KEY_INPUT);
    const b = buildRetrievalCacheKey({ ...BASE_KEY_INPUT, workspaceId: "ws-other" });
    expect(a).not.toBe(b);
  });

  it("changes when the project changes", () => {
    const a = buildRetrievalCacheKey(BASE_KEY_INPUT);
    const b = buildRetrievalCacheKey({ ...BASE_KEY_INPUT, projectId: "p-other" });
    expect(a).not.toBe(b);
  });

  it("changes when the module changes", () => {
    const a = buildRetrievalCacheKey(BASE_KEY_INPUT);
    const b = buildRetrievalCacheKey({ ...BASE_KEY_INPUT, moduleId: "uk_housing" });
    expect(a).not.toBe(b);
  });

  it("changes when the jurisdiction or law_area changes", () => {
    const a = buildRetrievalCacheKey(BASE_KEY_INPUT);
    const b = buildRetrievalCacheKey({ ...BASE_KEY_INPUT, jurisdiction: "UK_SCOTLAND" });
    const c = buildRetrievalCacheKey({ ...BASE_KEY_INPUT, lawArea: "housing" });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("changes when the context source hash changes", () => {
    const a = buildRetrievalCacheKey(BASE_KEY_INPUT);
    const b = buildRetrievalCacheKey({ ...BASE_KEY_INPUT, contextSourceHash: "ctx-different" });
    expect(a).not.toBe(b);
  });

  it("does NOT change when the question's whitespace / case / trailing punctuation differs", () => {
    const a = buildRetrievalCacheKey(BASE_KEY_INPUT);
    const b = buildRetrievalCacheKey({
      ...BASE_KEY_INPUT,
      question: "  What is the qualifying service for unfair dismissal? ",
    });
    expect(a).toBe(b);
  });
});

describe("runApprovedAnswerFastPath", () => {
  it("returns no_lookup_configured when no lookup is provided", async () => {
    const out = await runApprovedAnswerFastPath({ ...BASE_KEY_INPUT, nowIsoDate: NOW });
    expect(out.hit).toBe(false);
    if (out.hit) return;
    expect(out.reason).toBe("no_lookup_configured");
  });

  it("returns cache_miss when the lookup returns undefined", async () => {
    const lookup: ApprovedAnswerLookup = () => undefined;
    const out = await runApprovedAnswerFastPath({ ...BASE_KEY_INPUT, nowIsoDate: NOW, lookup });
    expect(out.hit).toBe(false);
    if (out.hit) return;
    expect(out.reason).toBe("cache_miss");
  });

  it("returns expired when the entry's expiresAt is in the past", async () => {
    const lookup: ApprovedAnswerLookup = () => mkEntry({ expiresAt: "2020-01-01" });
    const out = await runApprovedAnswerFastPath({ ...BASE_KEY_INPUT, nowIsoDate: NOW, lookup });
    expect(out.hit).toBe(false);
    if (out.hit) return;
    expect(out.reason).toBe("expired");
  });

  it("returns no_citations when citationCount is 0", async () => {
    const lookup: ApprovedAnswerLookup = () => mkEntry({ citationCount: 0 });
    const out = await runApprovedAnswerFastPath({ ...BASE_KEY_INPUT, nowIsoDate: NOW, lookup });
    expect(out.hit).toBe(false);
    if (out.hit) return;
    expect(out.reason).toBe("no_citations");
  });

  it("returns failed_qa when qaStatus is failed", async () => {
    const lookup: ApprovedAnswerLookup = () => mkEntry({ qaStatus: "failed" });
    const out = await runApprovedAnswerFastPath({ ...BASE_KEY_INPUT, nowIsoDate: NOW, lookup });
    expect(out.hit).toBe(false);
    if (out.hit) return;
    expect(out.reason).toBe("failed_qa");
  });

  it("returns draft_or_unreviewed when qaStatus is not approved", async () => {
    for (const status of ["draft", "unreviewed"] as const) {
      const lookup: ApprovedAnswerLookup = () => mkEntry({ qaStatus: status });
      const out = await runApprovedAnswerFastPath({ ...BASE_KEY_INPUT, nowIsoDate: NOW, lookup });
      expect(out.hit).toBe(false);
      if (out.hit) return;
      expect(out.reason).toBe("draft_or_unreviewed");
    }
  });

  it("returns a hit for a valid approved entry with citations", async () => {
    const lookup: ApprovedAnswerLookup = () => mkEntry({});
    const out = await runApprovedAnswerFastPath({ ...BASE_KEY_INPUT, nowIsoDate: NOW, lookup });
    expect(out.hit).toBe(true);
    if (!out.hit) return;
    expect(out.entry.qaStatus).toBe("approved");
    expect(out.reasonCodes).toContain("fast_path:hit");
  });

  it("preserves citation gates: a fresh approved entry with zero citations is refused", async () => {
    const lookup: ApprovedAnswerLookup = () =>
      mkEntry({ qaStatus: "approved", citationCount: 0, expiresAt: null });
    const out = await runApprovedAnswerFastPath({ ...BASE_KEY_INPUT, nowIsoDate: NOW, lookup });
    expect(out.hit).toBe(false);
  });
});

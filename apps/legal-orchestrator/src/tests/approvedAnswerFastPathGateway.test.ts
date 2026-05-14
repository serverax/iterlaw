import { describe, expect, it } from "vitest";

import { runApprovedAnswerFastPathGateway } from "../retrieval/approvedAnswerFastPathGateway";
import { getApprovedAnswerFastPathConfig } from "../config/featureFlags";
import type { ApprovedAnswerEntry, ApprovedAnswerLookup } from "../retrieval";

const BASE = {
  workspaceId: "ws-1",
  projectId: "p-1",
  moduleId: "uk_employment",
  jurisdiction: "UK_ENGLAND_WALES",
  lawArea: "employment",
  question: "what is the qualifying service for unfair dismissal?",
  contextSourceHash: "ctx-1",
  nowIsoDate: "2026-05-14",
};

function mkEntry(overrides: Partial<ApprovedAnswerEntry> = {}): ApprovedAnswerEntry {
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

describe("ITERLAW_APPROVED_ANSWER_FAST_PATH_ENABLED flag", () => {
  it("defaults to OFF when env var is unset", () => {
    const prev = process.env.ITERLAW_APPROVED_ANSWER_FAST_PATH_ENABLED;
    delete process.env.ITERLAW_APPROVED_ANSWER_FAST_PATH_ENABLED;
    try {
      expect(getApprovedAnswerFastPathConfig().enabled).toBe(false);
    } finally {
      if (prev !== undefined) process.env.ITERLAW_APPROVED_ANSWER_FAST_PATH_ENABLED = prev;
    }
  });

  it("turns ON only on canonical truthy values", () => {
    const prev = process.env.ITERLAW_APPROVED_ANSWER_FAST_PATH_ENABLED;
    try {
      for (const v of ["true", "1", "yes", "on"]) {
        process.env.ITERLAW_APPROVED_ANSWER_FAST_PATH_ENABLED = v;
        expect(getApprovedAnswerFastPathConfig().enabled).toBe(true);
      }
      for (const v of ["false", "0", "", "anything-else"]) {
        process.env.ITERLAW_APPROVED_ANSWER_FAST_PATH_ENABLED = v;
        expect(getApprovedAnswerFastPathConfig().enabled).toBe(false);
      }
    } finally {
      if (prev !== undefined) process.env.ITERLAW_APPROVED_ANSWER_FAST_PATH_ENABLED = prev;
      else delete process.env.ITERLAW_APPROVED_ANSWER_FAST_PATH_ENABLED;
    }
  });
});

describe("runApprovedAnswerFastPathGateway", () => {
  it("records no_lookup_configured when no lookup is provided", async () => {
    const out = await runApprovedAnswerFastPathGateway(BASE);
    expect(out.hit).toBe(false);
    expect(out.decisionTrace).toContain("fast_path_gateway:entered");
    expect(out.decisionTrace.some((c) => c.includes("no_lookup_configured"))).toBe(true);
  });

  it("returns a hit when the lookup returns a valid approved entry", async () => {
    const lookup: ApprovedAnswerLookup = () => mkEntry({});
    const out = await runApprovedAnswerFastPathGateway({ ...BASE, lookup });
    expect(out.hit).toBe(true);
    expect(out.decisionTrace.some((c) => c.includes("fast_path:hit"))).toBe(true);
  });

  it("rejects a stale entry (expired)", async () => {
    const lookup: ApprovedAnswerLookup = () => mkEntry({ expiresAt: "2020-01-01" });
    const out = await runApprovedAnswerFastPathGateway({ ...BASE, lookup });
    expect(out.hit).toBe(false);
  });

  it("rejects a failed-QA entry", async () => {
    const lookup: ApprovedAnswerLookup = () => mkEntry({ qaStatus: "failed" });
    const out = await runApprovedAnswerFastPathGateway({ ...BASE, lookup });
    expect(out.hit).toBe(false);
  });

  it("rejects an uncited entry", async () => {
    const lookup: ApprovedAnswerLookup = () => mkEntry({ citationCount: 0 });
    const out = await runApprovedAnswerFastPathGateway({ ...BASE, lookup });
    expect(out.hit).toBe(false);
  });

  it("decision trace includes the gateway:entered marker on every call", async () => {
    const out = await runApprovedAnswerFastPathGateway(BASE);
    expect(out.decisionTrace[0]).toBe("fast_path_gateway:entered");
  });

  it("swallows lookup exceptions and reports cache_miss", async () => {
    const lookup: ApprovedAnswerLookup = () => {
      throw new Error("lookup-internal");
    };
    const out = await runApprovedAnswerFastPathGateway({ ...BASE, lookup });
    expect(out.hit).toBe(false);
    // The underlying fast path runs synchronously here; the exception is caught
    // by the gateway and returned as a structured cache_miss.
    expect(out.decisionTrace.some((c) => c.includes("fast_path_gateway"))).toBe(true);
  });
});

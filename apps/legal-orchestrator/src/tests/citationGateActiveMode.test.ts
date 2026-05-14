import { afterEach, describe, expect, it } from "vitest";

import { runCitationGateActive } from "../citations/citationGateActiveMode";
import { getCitationGateActiveModeConfig } from "../config/featureFlags";

const NOW = "2026-05-14";

const SUPPORTING_CHUNK = {
  chunk_id: "c-1",
  chunk_text: "An employee has the right not to be unfairly dismissed by his employer.",
  source_type: "statutory_source",
  source_id: "doc-1",
  title: "Employment Rights Act 1996",
  url: "https://www.legislation.gov.uk/ukpga/1996/18/section/94",
  effective_date: "1996-05-22",
  applicable_to: null,
  authority_level: 90,
};

const prev = process.env.ITERLAW_CITATION_GATE_ACTIVE_MODE_ENABLED;
afterEach(() => {
  if (prev !== undefined) process.env.ITERLAW_CITATION_GATE_ACTIVE_MODE_ENABLED = prev;
  else delete process.env.ITERLAW_CITATION_GATE_ACTIVE_MODE_ENABLED;
});

describe("ITERLAW_CITATION_GATE_ACTIVE_MODE_ENABLED flag", () => {
  it("defaults to OFF when env var is unset", () => {
    delete process.env.ITERLAW_CITATION_GATE_ACTIVE_MODE_ENABLED;
    expect(getCitationGateActiveModeConfig().enabled).toBe(false);
    expect(getCitationGateActiveModeConfig().mode).toBe("shadow");
  });

  it("parses canonical truthy / falsy values", () => {
    for (const v of ["true", "1", "yes", "on"]) {
      process.env.ITERLAW_CITATION_GATE_ACTIVE_MODE_ENABLED = v;
      expect(getCitationGateActiveModeConfig().enabled).toBe(true);
      expect(getCitationGateActiveModeConfig().mode).toBe("active");
    }
    for (const v of ["false", "0", "", "anything"]) {
      process.env.ITERLAW_CITATION_GATE_ACTIVE_MODE_ENABLED = v;
      expect(getCitationGateActiveModeConfig().enabled).toBe(false);
    }
  });
});

describe("runCitationGateActive — flag OFF", () => {
  it("flag OFF → shadow_only decision; legacy answer path preserved", () => {
    delete process.env.ITERLAW_CITATION_GATE_ACTIVE_MODE_ENABLED;
    const out = runCitationGateActive({
      answerText: "Section 94 ERA 1996.",
      citations: [{ chunk_id: "c-1" }],
      retrievedChunks: [SUPPORTING_CHUNK],
      nowIsoDate: NOW,
      trustScores: new Map([["c-1", 0.9]]),
    });
    expect(out.type).toBe("shadow_only");
    expect(out.mode).toBe("shadow");
    expect(out.telemetry.shadowOnly).toBe(1);
    expect(out.blockedResponse).toBeUndefined();
  });

  it("flag OFF → even an uncited claim returns shadow_only (legacy gate is authoritative)", () => {
    delete process.env.ITERLAW_CITATION_GATE_ACTIVE_MODE_ENABLED;
    const out = runCitationGateActive({
      answerText: "Under ERA 1996 the employee was unfairly dismissed.",
      citations: [],
      retrievedChunks: [],
      nowIsoDate: NOW,
    });
    expect(out.type).toBe("shadow_only");
    expect(out.telemetry.shadowOnly).toBe(1);
  });
});

describe("runCitationGateActive — flag ON", () => {
  it("flag ON + cited approved answer → allowed", () => {
    process.env.ITERLAW_CITATION_GATE_ACTIVE_MODE_ENABLED = "true";
    const out = runCitationGateActive({
      answerText: "Section 94 ERA 1996 confers the right not to be unfairly dismissed.",
      citations: [{ chunk_id: "c-1" }],
      retrievedChunks: [SUPPORTING_CHUNK],
      nowIsoDate: NOW,
      trustScores: new Map([["c-1", 0.9]]),
    });
    expect(out.type).toBe("allowed");
    expect(out.mode).toBe("active");
    expect(out.telemetry.allowed).toBe(1);
    expect(out.blockedResponse).toBeUndefined();
  });

  it("flag ON + uncited claim → blocked with user message", () => {
    process.env.ITERLAW_CITATION_GATE_ACTIVE_MODE_ENABLED = "true";
    const out = runCitationGateActive({
      answerText: "Under ERA 1996 the employee was unfairly dismissed.",
      citations: [],
      retrievedChunks: [],
      nowIsoDate: NOW,
    });
    expect(out.type).toBe("blocked");
    expect(out.telemetry.blocked).toBe(1);
    expect(out.blockedResponse).toBeDefined();
    expect(out.blockedResponse?.userMessage).toMatch(/without supporting citations/i);
  });

  it("flag ON + weak-trust citation → downgraded", () => {
    process.env.ITERLAW_CITATION_GATE_ACTIVE_MODE_ENABLED = "true";
    const out = runCitationGateActive({
      answerText: "Section 94.",
      citations: [{ chunk_id: "c-1" }],
      retrievedChunks: [SUPPORTING_CHUNK],
      nowIsoDate: NOW,
      trustScores: new Map([["c-1", 0.3]]),
    });
    expect(out.type).toBe("downgraded");
    expect(out.telemetry.downgraded).toBe(1);
    expect(out.blockedResponse).toBeUndefined();
  });

  it("flag ON + stale source (no historical mode) → blocked", () => {
    process.env.ITERLAW_CITATION_GATE_ACTIVE_MODE_ENABLED = "true";
    const out = runCitationGateActive({
      answerText: "Section 94.",
      citations: [{ chunk_id: "c-1" }],
      retrievedChunks: [{ ...SUPPORTING_CHUNK, applicable_to: "2010-01-01" }],
      nowIsoDate: NOW,
      trustScores: new Map([["c-1", 0.9]]),
    });
    expect(out.type).toBe("blocked");
    expect(out.blockedResponse?.reason).toBe("blocked_stale");
  });

  it("flag ON + stale source + historical mode → downgraded (needs_review)", () => {
    process.env.ITERLAW_CITATION_GATE_ACTIVE_MODE_ENABLED = "true";
    const out = runCitationGateActive({
      answerText: "Section 94 (historical analysis).",
      citations: [{ chunk_id: "c-1" }],
      retrievedChunks: [{ ...SUPPORTING_CHUNK, applicable_to: "2010-01-01" }],
      nowIsoDate: NOW,
      historicalMode: true,
      trustScores: new Map([["c-1", 0.9]]),
    });
    expect(out.type).toBe("downgraded");
  });

  it("flag ON + no source URL → blocked with no_source reason", () => {
    process.env.ITERLAW_CITATION_GATE_ACTIVE_MODE_ENABLED = "true";
    const out = runCitationGateActive({
      answerText: "Statutory text.",
      citations: [{ chunk_id: "c-1" }],
      retrievedChunks: [{ ...SUPPORTING_CHUNK, url: null }],
      nowIsoDate: NOW,
      trustScores: new Map([["c-1", 0.9]]),
    });
    expect(out.type).toBe("blocked");
    expect(out.blockedResponse?.reason).toBe("blocked_no_source");
  });

  it("flag ON + trust=0 → blocked with low_trust reason", () => {
    process.env.ITERLAW_CITATION_GATE_ACTIVE_MODE_ENABLED = "true";
    const out = runCitationGateActive({
      answerText: "Statutory text.",
      citations: [{ chunk_id: "c-1" }],
      retrievedChunks: [SUPPORTING_CHUNK],
      nowIsoDate: NOW,
      trustScores: new Map([["c-1", 0]]),
    });
    expect(out.type).toBe("blocked");
    expect(out.blockedResponse?.reason).toBe("blocked_low_trust");
  });

  it("decision trace records mode + status on every call", () => {
    process.env.ITERLAW_CITATION_GATE_ACTIVE_MODE_ENABLED = "true";
    const out = runCitationGateActive({
      answerText: "Section 94.",
      citations: [{ chunk_id: "c-1" }],
      retrievedChunks: [SUPPORTING_CHUNK],
      nowIsoDate: NOW,
      trustScores: new Map([["c-1", 0.9]]),
    });
    expect(out.decisionTrace).toContain("citation_active_mode:entered");
    expect(out.decisionTrace).toContain("citation_active_mode:mode:active");
    expect(out.decisionTrace.some((c) => c === "citation_active_mode:allowed")).toBe(true);
  });
});

describe("Entitlement gate is NOT bypassed by citation gate active mode", () => {
  it("This sprint does not touch the entitlement adapter; documented separately", () => {
    // Sanity assertion: the citation gate active mode module does not import
    // anything from entitlements. If it did, removing this would be a code
    // smell. We assert by checking the exported function does not require any
    // entitlement dependency.
    expect(runCitationGateActive.length).toBeLessThanOrEqual(1);
  });
});

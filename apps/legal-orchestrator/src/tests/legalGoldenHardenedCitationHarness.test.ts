import { describe, expect, it } from "vitest";

import { GOLDEN_EVIDENCE_FIXTURES } from "./fixtures/legalGoldenEvidenceFixtures";
import { GOLDEN_EVIDENCE_FIXTURES_EXTENDED } from "./fixtures/legalGoldenEvidenceFixturesExtended";
import { runHardenedCitationGate } from "../citations/citationGateAdapter";
import type { CitationStatus } from "../citations/evidencePack.types";

const NOW = "2026-05-14";

const ALL_FIXTURES = [...GOLDEN_EVIDENCE_FIXTURES, ...GOLDEN_EVIDENCE_FIXTURES_EXTENDED];

function matches(expected: "pass" | "block" | "needs_review", status: CitationStatus): boolean {
  switch (expected) {
    case "pass":
      return status === "fully_cited";
    case "needs_review":
      return status === "needs_review";
    case "block":
      return status.startsWith("blocked_");
  }
}

describe("Sprint 42 — golden fixtures × runHardenedCitationGate", () => {
  it("the extended fixture set has at least 10 entries", () => {
    expect(GOLDEN_EVIDENCE_FIXTURES_EXTENDED.length).toBeGreaterThanOrEqual(10);
  });

  it("Sprint 42 covers every category called out in the spec", () => {
    const ids = GOLDEN_EVIDENCE_FIXTURES_EXTENDED.map((f) => f.id);
    for (const expected of [
      "ext_strong_citation",
      "ext_missing_citation",
      "ext_wrong_jurisdiction",
      "ext_expired_source",
      "ext_unsupported_statutory_rate",
      "ext_entitlement_mismatch_low_trust",
      "ext_weak_citation",
      "ext_calculator_with_cited_basis",
      "ext_vector_result_with_citation",
      "ext_cache_stale_source_version",
    ]) {
      expect(ids).toContain(expected);
    }
  });

  it("every fixture in the combined set produces a deterministic PASS / FAIL result against the hardened gate", () => {
    const failures: string[] = [];
    for (const f of ALL_FIXTURES) {
      const decision = runHardenedCitationGate({
        answerText: f.answerText,
        citations: f.citations.slice(),
        retrievedChunks: f.retrievedCandidates.map((c) => ({
          chunk_id: c.candidate_id,
          chunk_text: c.text,
          source_type: c.source_type,
          source_id: c.source_id,
          title: c.source_title ?? null,
          url: c.source_url ?? null,
          effective_date: c.effective_from ?? null,
          applicable_to: c.effective_to ?? null,
          authority_level: c.authority_level ?? null,
        })),
        nowIsoDate: NOW,
        historicalMode: f.historicalMode,
        trustScores: f.trustScores ? new Map(Object.entries(f.trustScores)) : undefined,
      });
      if (!matches(f.expected_outcome, decision.overallStatus)) {
        failures.push(
          `fixture '${f.id}' expected '${f.expected_outcome}' but gate returned '${decision.overallStatus}'`,
        );
      }
    }
    // Surface every failure in a single message for readability.
    expect(failures, failures.join("\n")).toHaveLength(0);
  });

  it("decision trace from the hardened gate is non-empty for every fixture", () => {
    for (const f of ALL_FIXTURES) {
      const decision = runHardenedCitationGate({
        answerText: f.answerText,
        citations: f.citations.slice(),
        retrievedChunks: f.retrievedCandidates.map((c) => ({
          chunk_id: c.candidate_id,
          chunk_text: c.text,
          source_type: c.source_type,
          source_id: c.source_id,
          title: c.source_title ?? null,
          url: c.source_url ?? null,
          effective_date: c.effective_from ?? null,
          applicable_to: c.effective_to ?? null,
          authority_level: c.authority_level ?? null,
        })),
        nowIsoDate: NOW,
        historicalMode: f.historicalMode,
        trustScores: f.trustScores ? new Map(Object.entries(f.trustScores)) : undefined,
      });
      expect(decision.decisionTrace[0]).toBe("citation_gate:entered");
      expect(decision.decisionTrace.length).toBeGreaterThan(1);
    }
  });

  it("combined fixture catalogue has at least 20 entries (Sprint 34 + Sprint 42)", () => {
    expect(ALL_FIXTURES.length).toBeGreaterThanOrEqual(20);
  });
});

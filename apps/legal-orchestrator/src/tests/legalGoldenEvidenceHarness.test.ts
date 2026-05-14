import { describe, expect, it } from "vitest";

import { GOLDEN_EVIDENCE_FIXTURES } from "./fixtures/legalGoldenEvidenceFixtures";
import { buildEvidencePack } from "../citations/evidencePackBuilder";
import type { CitationStatus } from "../citations/evidencePack.types";

const NOW = "2026-05-14";

function expectedToOverallStatus(expected: "pass" | "block" | "needs_review", status: CitationStatus): boolean {
  switch (expected) {
    case "pass":
      return status === "fully_cited";
    case "needs_review":
      return status === "needs_review";
    case "block":
      return status.startsWith("blocked_");
  }
}

describe("GOLDEN_EVIDENCE_FIXTURES — fixture catalogue", () => {
  it("contains at least 10 scenarios", () => {
    expect(GOLDEN_EVIDENCE_FIXTURES.length).toBeGreaterThanOrEqual(10);
  });

  it("every fixture has an evidence_status and expected_outcome", () => {
    for (const f of GOLDEN_EVIDENCE_FIXTURES) {
      expect(["supported", "missing", "stale", "weak"]).toContain(f.evidence_status);
      expect(["pass", "block", "needs_review"]).toContain(f.expected_outcome);
    }
  });

  it("fixtures with evidence_status=missing always expect block", () => {
    for (const f of GOLDEN_EVIDENCE_FIXTURES) {
      if (f.evidence_status === "missing") expect(f.expected_outcome).toBe("block");
    }
  });

  it("stale fixtures expect block unless historicalMode is true", () => {
    for (const f of GOLDEN_EVIDENCE_FIXTURES) {
      if (f.evidence_status === "stale") {
        if (f.historicalMode) expect(f.expected_outcome).toBe("needs_review");
        else expect(f.expected_outcome).toBe("block");
      }
    }
  });

  it("weak-trust fixtures expect needs_review", () => {
    for (const f of GOLDEN_EVIDENCE_FIXTURES) {
      if (f.evidence_status === "weak") expect(f.expected_outcome).toBe("needs_review");
    }
  });
});

describe("Evidence harness — actual vs expected via evidencePackBuilder", () => {
  it("runs every fixture and matches the expected outcome", () => {
    for (const f of GOLDEN_EVIDENCE_FIXTURES) {
      const pack = buildEvidencePack({
        answerText: f.answerText,
        citations: f.citations.slice(),
        retrievedCandidates: f.retrievedCandidates.slice(),
        nowIsoDate: NOW,
        historicalMode: f.historicalMode,
        trustScores: f.trustScores ? new Map(Object.entries(f.trustScores)) : undefined,
      });
      const match = expectedToOverallStatus(f.expected_outcome, pack.overallStatus);
      expect(
        match,
        `fixture '${f.id}' expected '${f.expected_outcome}' but pack overallStatus is '${pack.overallStatus}'`,
      ).toBe(true);
    }
  });

  it("no unsupported answer slips through (no expected=pass fixture has missing/stale/weak evidence_status)", () => {
    for (const f of GOLDEN_EVIDENCE_FIXTURES) {
      if (f.expected_outcome === "pass") {
        expect(f.evidence_status).toBe("supported");
      }
    }
  });

  it("every fixture produces a non-empty reasonCodes array on the pack", () => {
    for (const f of GOLDEN_EVIDENCE_FIXTURES) {
      const pack = buildEvidencePack({
        answerText: f.answerText,
        citations: f.citations.slice(),
        retrievedCandidates: f.retrievedCandidates.slice(),
        nowIsoDate: NOW,
        historicalMode: f.historicalMode,
        trustScores: f.trustScores ? new Map(Object.entries(f.trustScores)) : undefined,
      });
      expect(pack.reasonCodes.length).toBeGreaterThan(0);
    }
  });
});

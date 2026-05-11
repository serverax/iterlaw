// Tests for the modulePipeline orchestration wrapper.
// All inputs are constructed in-memory. No I/O.

import { describe, it, expect } from "vitest";
import { runLegalModulePipeline } from "../modules/modulePipeline";
import type { RetrievedChunk, CitationInput } from "../modules/contracts";

const baseChunks: RetrievedChunk[] = [
  {
    chunk_id: "era-s95",
    source_type: "legislation",
    citation_label: "Employment Rights Act 1996 s.95",
    chunk_text:
      "An employee is dismissed when the contract is terminated by the employer.",
    authority_level: 100,
  },
  {
    chunk_id: "acas-disc-2015",
    source_type: "acas_guidance",
    citation_label: "ACAS Code of Practice (Disciplinary and Grievance)",
    chunk_text:
      "Employers should follow a fair procedure including a warning, an investigation, and a right to be accompanied.",
    authority_level: 60,
  },
];

describe("runLegalModulePipeline — normal UK employment question", () => {
  it("loads UK legal pack by default and produces an audit trail", () => {
    const out = runLegalModulePipeline({
      userQuestion: "Can I claim unfair dismissal?",
      retrievedChunks: baseChunks,
      classification: { area_of_law: "unfair_dismissal", requires_deadline_check: true },
      facts: { dismissal_date: "2026-04-01", acas_started: true },
      now_iso: "2026-04-15",
    });
    expect(out.legalPackId).toBe("uk_employment_england_wales");
    expect(out.auditTrace[0]).toBe("legal_pack_loaded:uk_employment_england_wales");
    expect(out.auditTrace).toContain("deadline_check:ok");
    expect(out.auditTrace).toContain("sources_ranked:2");
    expect(out.finalAllowed).toBe(true);
    expect(out.blockedReasons).toEqual([]);
  });

  it("falls back to SE legal pack when explicitly requested", () => {
    const out = runLegalModulePipeline({
      userQuestion: "Kan jag bli uppsagd utan varsel?",
      legalPackId: "se_employment",
    });
    expect(out.legalPackId).toBe("se_employment");
  });
});

describe("runLegalModulePipeline — deadline risk", () => {
  it("emits deadline warnings when limitation is imminent", () => {
    const seventyFive = new Date();
    seventyFive.setDate(seventyFive.getDate() - 85);
    const out = runLegalModulePipeline({
      userQuestion: "I was unfairly dismissed",
      classification: { area_of_law: "unfair_dismissal", requires_deadline_check: true },
      facts: {
        dismissal_date: seventyFive.toISOString().slice(0, 10),
        acas_started: false,
      },
    });
    expect(out.warnings.length).toBeGreaterThan(0);
    expect(out.warnings.join(" ")).toMatch(/limitation/i);
  });
});

describe("runLegalModulePipeline — citation gate", () => {
  it("blocks a draft answer with unknown chunk citation", () => {
    const out = runLegalModulePipeline({
      userQuestion: "Can I claim unfair dismissal?",
      draftAnswer: "Under ERA 1996 s.95 the employer's act constitutes dismissal.",
      declaredCitations: [{ chunk_id: "does-not-exist" } as CitationInput],
      retrievedChunks: baseChunks,
      classification: { area_of_law: "unfair_dismissal", requires_deadline_check: true },
      facts: { dismissal_date: "2026-04-01", acas_started: true },
    });
    expect(out.finalAllowed).toBe(false);
    expect(out.blockedReasons.some((r) => r.startsWith("citation:"))).toBe(true);
  });

  it("blocks a draft answer that has zero citations but makes legal claims", () => {
    const out = runLegalModulePipeline({
      userQuestion: "Can I claim unfair dismissal?",
      draftAnswer:
        "You are entitled to bring an unfair dismissal claim under the Employment Rights Act 1996.",
      declaredCitations: [],
      retrievedChunks: baseChunks,
      classification: { area_of_law: "unfair_dismissal", requires_deadline_check: true },
      facts: { dismissal_date: "2026-04-01", acas_started: true },
    });
    expect(out.finalAllowed).toBe(false);
    expect(out.blockedReasons).toEqual(
      expect.arrayContaining([
        "citation:citation_missing",
        "citation:answer_makes_claims_without_citations",
      ])
    );
  });
});

describe("runLegalModulePipeline — policy gate", () => {
  it("blocks a draft answer that uses guaranteed-success language", () => {
    const out = runLegalModulePipeline({
      userQuestion: "Will I win at tribunal?",
      draftAnswer:
        "You will win this case. The tribunal will rule in your favour. Subject to the 3 months less one day limitation and ACAS Early Conciliation.",
      declaredCitations: [{ chunk_id: "era-s95" }],
      retrievedChunks: baseChunks,
      classification: { area_of_law: "unfair_dismissal", requires_deadline_check: true },
      facts: { dismissal_date: "2026-04-01", acas_started: true },
    });
    expect(out.finalAllowed).toBe(false);
    expect(out.blockedReasons.some((r) => r.startsWith("policy:"))).toBe(true);
    expect(out.policyStatus.blocked_terms).toEqual(
      expect.arrayContaining(["guaranteed_you_will_win", "guaranteed_tribunal_will"])
    );
  });
});

describe("runLegalModulePipeline — PII redaction", () => {
  it("redacts email + phone + NI + postcode in the user question", () => {
    const out = runLegalModulePipeline({
      userQuestion:
        "Contact me at jane.doe@example.co.uk or +44 7700 900123. NI AB123456C, postcode SW1A 1AA.",
    });
    expect(out.safeUserText).toMatch(/\[EMAIL_1\]/);
    expect(out.safeUserText).toMatch(/\[PHONE_1\]/);
    expect(out.safeUserText).toMatch(/\[NI_NUMBER_1\]/);
    expect(out.safeUserText).toMatch(/\[POSTCODE_1\]/);
    expect(out.safeUserText).not.toContain("jane.doe@example.co.uk");
    expect(out.safeUserText).not.toContain("AB123456C");
  });

  it("also redacts the draft answer when supplied", () => {
    const out = runLegalModulePipeline({
      userQuestion: "Any question.",
      draftAnswer: "Please email jane.doe@example.co.uk for follow-up.",
    });
    expect(out.safeDraftAnswer).toBeDefined();
    expect(out.safeDraftAnswer).toContain("[EMAIL_1]");
    expect(out.safeDraftAnswer).not.toContain("jane.doe@example.co.uk");
  });
});

describe("runLegalModulePipeline — sourceRanker influences order", () => {
  it("places statute above guidance for a dismissal query", () => {
    const out = runLegalModulePipeline({
      userQuestion: "An employee is dismissed when the contract is terminated by the employer.",
      retrievedChunks: baseChunks,
    });
    expect(out.rankedSources.length).toBe(2);
    expect(out.rankedSources[0]?.chunk_id).toBe("era-s95");
  });

  it("produces ranker_score in 0..1 for every ranked source", () => {
    const out = runLegalModulePipeline({
      userQuestion: "anything",
      retrievedChunks: baseChunks,
    });
    for (const s of out.rankedSources) {
      expect(s.ranker_score).toBeGreaterThanOrEqual(0);
      expect(s.ranker_score).toBeLessThanOrEqual(1);
    }
  });
});

describe("runLegalModulePipeline — purity", () => {
  it("is synchronous: returns a non-Promise value", () => {
    const out = runLegalModulePipeline({ userQuestion: "x" });
    expect(typeof (out as unknown as { then?: unknown }).then).toBe("undefined");
  });
});

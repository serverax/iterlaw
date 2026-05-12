import { describe, it, expect } from "vitest";
import { runLegalModulePipeline } from "../modules/modulePipeline";
import { handleLegalRequest } from "../pipeline/handleLegalRequest";
import type { LegalRequest, RagChunk } from "../types/legal";

describe("runLegalModulePipeline (orchestration)", () => {
  it("lets a normal UK employment question through when no draft is supplied", () => {
    const out = runLegalModulePipeline({
      userQuestion: "What is the minimum holiday entitlement under the Working Time Regulations?",
      classification: { area_of_law: "holiday_pay", requires_deadline_check: false },
      facts: {},
      legalPackId: "uk_employment_england_wales",
      jurisdiction: "uk_ew",
    });
    expect(out.legalPackId).toBe("uk_employment_england_wales");
    expect(out.finalAllowed).toBe(true);
    expect(out.blockedReasons).toEqual([]);
    expect(out.auditTrace.some((s) => s.startsWith("legal_pack_loaded:"))).toBe(true);
  });

  it("surfaces deadline warnings when limitation is imminent", () => {
    const out = runLegalModulePipeline({
      userQuestion: "Was my dismissal unfair?",
      classification: { area_of_law: "unfair_dismissal", requires_deadline_check: true },
      facts: {
        dismissal_date: "2026-02-15",
        acas_started: true,
      },
      jurisdiction: "uk_ew",
      now_iso: "2026-05-11T12:00:00.000Z",
    });
    expect(out.deadlineWarnings.length).toBeGreaterThan(0);
    expect(out.warnings.join(" ")).toMatch(/limitation|ACAS|Statutory/i);
  });

  it("blocks unsupported citations (chunk not in retrieval set)", () => {
    const out = runLegalModulePipeline({
      userQuestion: "Unfair dismissal",
      draftAnswer: "Under the Employment Rights Act 1996 the tribunal may consider your claim.",
      retrievedChunks: [
        {
          chunk_id: "only-chunk",
          source_type: "legislation",
          chunk_text: "An employer shall have regard to the reason for dismissal.",
          authority_level: 100,
        },
      ],
      declaredCitations: [{ chunk_id: "wrong-chunk", quote_text: "reason" }],
      classification: { area_of_law: "unfair_dismissal", requires_deadline_check: true },
      facts: { dismissal_date: "2025-01-01", acas_started: true },
      jurisdiction: "uk_ew",
    });
    expect(out.finalAllowed).toBe(false);
    expect(out.blockedReasons.some((r) => r.startsWith("citation:"))).toBe(true);
    expect(out.citationStatus.failures.some((f) => f.startsWith("chunk_not_found"))).toBe(true);
  });

  it("catches forbidden legal wording via policyGate", () => {
    const out = runLegalModulePipeline({
      userQuestion: "Do I have a claim?",
      draftAnswer:
        "You will win this case. The deadline is 3 months less one day and you should contact ACAS.",
      retrievedChunks: [
        {
          chunk_id: "c1",
          source_type: "legislation",
          chunk_text: "Fair reasons for dismissal include conduct and capability.",
          authority_level: 100,
        },
      ],
      declaredCitations: [{ chunk_id: "c1", quote_text: "Fair reasons" }],
      classification: { area_of_law: "unfair_dismissal", requires_deadline_check: true },
      facts: { dismissal_date: "2025-06-01", acas_started: true },
      jurisdiction: "uk_ew",
    });
    expect(out.finalAllowed).toBe(false);
    expect(out.policyStatus.blocked_terms).toContain("guaranteed_you_will_win");
  });

  it("redacts PII in safeUserText before audit-facing outputs", () => {
    const out = runLegalModulePipeline({
      userQuestion: "Contact me at jane.doe@example.com about my dismissal",
      classification: { area_of_law: "holiday_pay", requires_deadline_check: false },
      facts: {},
    });
    expect(out.safeUserText).toMatch(/\[EMAIL_1\]/);
    expect(out.safeUserText).not.toContain("jane.doe@example.com");
    expect(out.auditTrace.some((t) => t.startsWith("pii_redacted_question:1"))).toBe(true);
  });

  it("applies sourceRanker ordering (higher-authority legislation before low template)", () => {
    const out = runLegalModulePipeline({
      userQuestion: "What are my rights to holiday pay during suspension?",
      classification: { area_of_law: "suspension", requires_deadline_check: false },
      facts: { suspension_date: "2026-04-01" },
      retrievedChunks: [
        {
          chunk_id: "tpl-a",
          source_type: "template",
          citation_label: "Internal template",
          chunk_text: "holiday pay suspension template boilerplate",
          authority_level: 15,
        },
        {
          chunk_id: "leg-b",
          source_type: "legislation",
          citation_label: "WTR 1998",
          chunk_text: "A worker has the right to paid annual leave under the Working Time Regulations.",
          authority_level: 100,
        },
      ],
    });
    expect(out.rankedSources.length).toBe(2);
    expect(out.rankedSources[0].chunk_id).toBe("leg-b");
    expect(out.rankedSources[0].ranker_score).toBeGreaterThanOrEqual(out.rankedSources[1].ranker_score);
  });
});

describe("handleLegalRequest + module pipeline", () => {
  const baseReq: LegalRequest = {
    request_id: "req-wire-1",
    user_id: "u1",
    workspace_id: "w1",
    mode: "ask",
    question: "I think my dismissal was unfair — what are my options?",
    facts: {
      dismissal_date: "2026-04-01",
      acas_started: true,
    },
  };

  const mockChunk: RagChunk = {
    chunk_id: "chunk-era-1",
    document_id: "doc-era",
    source_type: "legislation",
    authority_level: 100,
    title: "Employment Rights Act 1996",
    url: "https://legislation.gov.uk/ukpga/1996/18",
    section_reference: "98",
    chunk_text: "An employer shall have regard to the reason or principal reason for the dismissal.",
    score: 0.95,
  };

  it("returns the same LegalResponse envelope keys when RAG returns chunks (citation_failed skeleton)", async () => {
    const res = await handleLegalRequest(baseReq, {
      rag: {
        async search() {
          return [mockChunk];
        },
      },
    });
    expect(res.status).toBe("citation_failed");
    expect(res.request_id).toBe(baseReq.request_id);
    expect(res).toMatchObject({
      legal_pack: "uk_employment_england_wales",
      jurisdiction: "England and Wales",
      rag_used: true,
      external_llm_used: false,
      synthesis_status: "not_attempted",
      synthesis_mode: "redis_streams",
      citations: [],
      confidence_score: 0,
    });
    expect(typeof res.answer).toBe("string");
    expect(Array.isArray(res.next_steps)).toBe(true);
    expect(res.next_steps.length).toBeGreaterThan(0);
    // model_used is not part of the orchestrator response surface — model
    // selection belongs to synthesis-worker, not legal-orchestrator.
    expect((res as Record<string, unknown>).model_used).toBeUndefined();
    expect(res.external_llm_used).toBe(false);
  });
});

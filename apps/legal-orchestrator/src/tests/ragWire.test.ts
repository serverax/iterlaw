// Tests proving that handleLegalRequest now consumes the RetrievalPort
// when one is injected, and that retrieval_notes / ranked chunks flow
// through to the response and the module pipeline.

import { describe, it, expect } from "vitest";
import { handleLegalRequest } from "../pipeline/handleLegalRequest";
import { MockRetrieval, SAMPLE_UK_EMPLOYMENT_CORPUS } from "../rag";

describe("handleLegalRequest — retrieval wiring (RetrievalPort injection)", () => {
  it("returns insufficient_sources when the injected retrieval port returns no chunks", async () => {
    const port = new MockRetrieval({ corpus: [] });
    const res = await handleLegalRequest(
      {
        request_id: "wire-1",
        user_id: "u",
        workspace_id: "w",
        mode: "ask",
        question: "Can my employer suspend me without telling me why?",
        facts: { suspension_date: "2026-05-01" },
      },
      { retrieval: port }
    );
    expect(res.status).toBe("insufficient_sources");
    expect(res.citations).toEqual([]);
    expect(res.external_llm_used).toBe(false);
    // Retrieval notes must surface in next_steps prefixed with "retrieval:".
    expect(res.next_steps.some((s) => s.startsWith("retrieval:"))).toBe(true);
  });

  it("passes injected chunks through to the module pipeline (chunks.length > 0)", async () => {
    const port = new MockRetrieval({ corpus: SAMPLE_UK_EMPLOYMENT_CORPUS });
    const res = await handleLegalRequest(
      {
        request_id: "wire-2",
        user_id: "u",
        workspace_id: "w",
        mode: "ask",
        question: "Can I claim unfair dismissal? dismissal of an employee",
        facts: { dismissal_date: "2026-05-01", acas_started: true, employment_start_date: "2018-01-01" },
      },
      { retrieval: port }
    );
    // With chunks available but no real LLM draft, the orchestrator's
    // policy gate refuses any uncited answer -> citation_failed (or
    // policy_failed). Either way: NOT insufficient_sources, NOT safe_answer
    // without citations, and external_llm_used must remain false.
    expect(res.status).not.toBe("insufficient_sources");
    expect(res.external_llm_used).toBe(false);
    expect(res.citations).toEqual([]);
    expect(["citation_failed", "policy_failed", "safe_answer"]).toContain(res.status);
  });

  it("when retrieval has results, rag_used is true regardless of final answer status", async () => {
    const port = new MockRetrieval({ corpus: SAMPLE_UK_EMPLOYMENT_CORPUS });
    const res = await handleLegalRequest(
      {
        request_id: "wire-3",
        user_id: "u",
        workspace_id: "w",
        mode: "ask",
        question: "What constitutes dismissal under the Employment Rights Act?",
        facts: { dismissal_date: "2026-05-01", acas_started: true },
      },
      { retrieval: port }
    );
    expect(res.rag_used).toBe(true);
  });
});

describe("handleLegalRequest — backwards compatibility", () => {
  it("still works with the legacy `rag` injection (RagPort) returning empty chunks", async () => {
    const res = await handleLegalRequest(
      {
        request_id: "legacy-1",
        user_id: "u",
        workspace_id: "w",
        mode: "ask",
        question: "Can I claim unfair dismissal?",
      },
      { rag: { async search() { return []; } } }
    );
    expect(res.status).toBe("needs_more_facts"); // dismissal_date missing
  });

  it("without any deps, defaults to the mock-safe RagService (empty chunks)", async () => {
    const res = await handleLegalRequest({
      request_id: "default-1",
      user_id: "u",
      workspace_id: "w",
      mode: "ask",
      question: "Can my employer suspend me without telling me why?",
      facts: { suspension_date: "2026-05-01" },
    });
    expect(res.status).toBe("insufficient_sources");
    // The default service surfaces an empty_mock_default note.
    expect(res.next_steps.some((s) => s.startsWith("retrieval:"))).toBe(true);
  });
});

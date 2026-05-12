// Bounded synthesis guard — Sprint 11.
//
// Verifies every refusal mode and proves the guard never produces
// answer text from model memory.

import { describe, it, expect } from "vitest";
import { runBoundedSynthesis } from "../legal/llm/boundedSynthesis";
import type {
  BoundedSynthesisInput,
  LlmGatewayStatus,
  RetrievedLegalChunkForSynthesis,
} from "../legal/llm/llmGateway.types";

const disabledGateway: LlmGatewayStatus = {
  configured: false,
  mode: "disabled",
  available: false,
  reason: "DISABLED",
};

const availableGateway: LlmGatewayStatus = {
  configured: true,
  mode: "ollama",
  available: true,
};

function completeChunk(overrides: Partial<RetrievedLegalChunkForSynthesis> = {}): RetrievedLegalChunkForSynthesis {
  return {
    chunkId: "c-1",
    documentId: "d-1",
    title: "Employment Rights Act 1996 s.95",
    url: "https://www.legislation.gov.uk/ukpga/1996/18/section/95",
    citationLabel: "ERA 1996 s.95(1)",
    text: "An employee is dismissed by his employer if...",
    sourceType: "legislation",
    effectiveDate: "1996-08-22",
    ...overrides,
  };
}

function baseInput(chunks: RetrievedLegalChunkForSynthesis[] = []): BoundedSynthesisInput {
  return {
    question: "When am I considered dismissed under ERA 1996?",
    facts: { dismissal_date: "2026-05-01" },
    retrievedChunks: chunks,
  };
}

describe("runBoundedSynthesis — refusal modes", () => {
  it("returns insufficient_sources when no chunks are supplied", () => {
    const r = runBoundedSynthesis(baseInput([]), disabledGateway);
    expect(r.status).toBe("insufficient_sources");
    expect(r.citations).toEqual([]);
    expect(r.answer).toBeUndefined();
  });

  it("returns citation_failed when any chunk is missing required citation metadata", () => {
    const r = runBoundedSynthesis(
      baseInput([completeChunk(), completeChunk({ url: "" })]),
      disabledGateway
    );
    expect(r.status).toBe("citation_failed");
    expect(r.answer).toBeUndefined();
    // Only the complete chunk's citation survives.
    expect(r.citations).toHaveLength(1);
  });

  it("returns citation_failed when chunk text is missing", () => {
    const r = runBoundedSynthesis(
      baseInput([completeChunk({ text: "" })]),
      disabledGateway
    );
    expect(r.status).toBe("citation_failed");
  });

  it("returns llm_unavailable when chunks are complete but gateway is disabled", () => {
    const r = runBoundedSynthesis(baseInput([completeChunk()]), disabledGateway);
    expect(r.status).toBe("llm_unavailable");
    expect(r.answer).toBeUndefined();
    expect(r.citations).toHaveLength(1);
    expect(r.citations[0].citationLabel).toBe("ERA 1996 s.95(1)");
  });

  it("preserves every retrieved chunk's citation metadata", () => {
    const chunks = [
      completeChunk({ chunkId: "c-1", citationLabel: "ERA 1996 s.95" }),
      completeChunk({ chunkId: "c-2", citationLabel: "EqA 2010 s.13" }),
    ];
    const r = runBoundedSynthesis(baseInput(chunks), disabledGateway);
    expect(r.citations.map((c) => c.chunkId)).toEqual(["c-1", "c-2"]);
    expect(r.citations.map((c) => c.citationLabel)).toEqual([
      "ERA 1996 s.95",
      "EqA 2010 s.13",
    ]);
  });

  it("does NOT produce answer text in disabled mode", () => {
    const r = runBoundedSynthesis(baseInput([completeChunk()]), disabledGateway);
    expect(r.answer).toBeUndefined();
    expect(r.safetyNotes.some((n) => n.toLowerCase().includes("model memory"))).toBe(true);
  });

  it("returns blocked_by_policy in the available-but-not-implemented state (Sprint 11)", () => {
    const r = runBoundedSynthesis(baseInput([completeChunk()]), availableGateway);
    expect(r.status).toBe("blocked_by_policy");
    expect(r.answer).toBeUndefined();
    expect(r.safetyNotes.some((n) => n.toLowerCase().includes("not enabled"))).toBe(true);
  });
});

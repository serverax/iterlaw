// Bounded synthesis guard — Sprint 11.
//
// Refuses to produce a legal answer unless every required citation
// field is present on every retrieved chunk. In the disabled / no-
// adapter state the guard returns `llm_unavailable` with the citation
// set preserved so the caller can render "no answer; here are the
// sources we would have used".

import type {
  BoundedSynthesisCitation,
  BoundedSynthesisInput,
  BoundedSynthesisOutput,
  LlmGatewayStatus,
  RetrievedLegalChunkForSynthesis,
} from "./llmGateway.types";

function hasCompleteCitationMetadata(chunk: RetrievedLegalChunkForSynthesis): boolean {
  return Boolean(
    chunk.chunkId &&
      chunk.documentId &&
      chunk.title &&
      chunk.url &&
      chunk.citationLabel &&
      chunk.text
  );
}

function toCitation(chunk: RetrievedLegalChunkForSynthesis): BoundedSynthesisCitation {
  return {
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    title: chunk.title,
    url: chunk.url,
    citationLabel: chunk.citationLabel,
  };
}

export function runBoundedSynthesis(
  input: BoundedSynthesisInput,
  gateway: LlmGatewayStatus
): BoundedSynthesisOutput {
  if (input.retrievedChunks.length === 0) {
    return {
      status: "insufficient_sources",
      citations: [],
      safetyNotes: ["No retrieved legal chunks were supplied."],
    };
  }

  const incomplete = input.retrievedChunks.some(
    (chunk) => !hasCompleteCitationMetadata(chunk)
  );

  if (incomplete) {
    return {
      status: "citation_failed",
      citations: input.retrievedChunks
        .filter(hasCompleteCitationMetadata)
        .map(toCitation),
      safetyNotes: [
        "One or more retrieved chunks is missing required citation metadata.",
      ],
    };
  }

  const citations = input.retrievedChunks.map(toCitation);

  if (!gateway.available) {
    return {
      status: "llm_unavailable",
      citations,
      safetyNotes: [
        "Local LLM gateway is unavailable.",
        "No answer was generated from model memory.",
      ],
    };
  }

  return {
    status: "blocked_by_policy",
    citations,
    safetyNotes: [
      "Live synthesis is not enabled in Sprint 11.",
      "Bounded synthesis must be implemented behind citation and safety gates.",
    ],
  };
}

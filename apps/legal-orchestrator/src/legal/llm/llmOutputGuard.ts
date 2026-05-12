// Pure output guard. Validates the local LLM's raw output:
//   - empty answer        -> reject (`empty_answer`).
//   - zero citations      -> reject (`zero_citations`).
//   - cited chunkId NOT in the retrieved set -> reject
//     (`hallucinated_citation`).
//   - otherwise           -> return the answer + structured citations
//     pulled from the retrieved chunks (never from model output).
//
// The guard never trusts the model's metadata. Citation labels / URLs
// come from the original retrieved chunks, looked up by chunkId.

import type {
  BoundedSynthesisCitation,
  RetrievedLegalChunkForSynthesis,
} from "./llmGateway.types";
import type { LlmOutputGuardResult, LlmRawOutput } from "./llm.types";

export function guardLlmOutput(
  raw: LlmRawOutput,
  retrievedChunks: RetrievedLegalChunkForSynthesis[],
): LlmOutputGuardResult {
  if (!raw.answer || raw.answer.trim().length === 0) {
    return { ok: false, reason: "empty_answer" };
  }

  if (!Array.isArray(raw.citedChunkIds) || raw.citedChunkIds.length === 0) {
    return { ok: false, reason: "zero_citations" };
  }

  const allowed = new Map<string, RetrievedLegalChunkForSynthesis>();
  for (const c of retrievedChunks) {
    allowed.set(c.chunkId, c);
  }

  const citations: BoundedSynthesisCitation[] = [];
  for (const id of raw.citedChunkIds) {
    const chunk = allowed.get(id);
    if (!chunk) {
      return { ok: false, reason: "hallucinated_citation" };
    }
    citations.push({
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      title: chunk.title,
      url: chunk.url,
      citationLabel: chunk.citationLabel,
    });
  }

  return { ok: true, answer: raw.answer, citations };
}

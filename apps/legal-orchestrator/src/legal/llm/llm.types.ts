// Sprint 11 — local LLM types for the router / prompt / output guard /
// transport. Gateway / synthesis types remain in `llmGateway.types.ts`.
// All types here are pure; no I/O, no global side-effects.

import type {
  BoundedSynthesisCitation,
  RetrievedLegalChunkForSynthesis,
} from "./llmGateway.types";

export type LlmTask =
  | "legal_drafting"
  | "drafting_letter"
  | "document_summary"
  | "small_helper"
  | "classification";

/**
 * Local model identifiers as configured in the synthesis-worker
 * ConfigMap (`k8s/iterlaw/synthesis-worker/configmap.yaml`). These are
 * Ollama `name:tag` strings, NOT container image references. The
 * router only emits values from this union — never a public-provider
 * model name.
 */
export type LocalModelTag =
  | "uk-employment-qwen:latest"
  | "uk-employment-drafting:latest"
  | "uk-employment-document:latest";

export interface ModelRouteRequest {
  task: LlmTask;
  /** Whether the orchestrator has at least one retrieved chunk. */
  hasRetrievedChunks: boolean;
}

export type ModelRouteDecision =
  | { ok: true; model: LocalModelTag; reason?: string }
  | { ok: false; reason: "refused_no_citations" | "unknown_task" };

export interface CitationBoundPromptInput {
  question: string;
  retrievedChunks: RetrievedLegalChunkForSynthesis[];
  jurisdiction?: string;
  /** Derived "law as at" date (ISO YYYY-MM-DD). */
  applicableOn?: string;
}

export interface CitationBoundPromptOutput {
  systemPrompt: string;
  userPrompt: string;
  /**
   * Whitelist of chunk_ids the model is allowed to cite. The output
   * guard rejects any cited id not in this list.
   */
  allowedCitationIds: string[];
}

export interface LlmRawOutput {
  /** Free-text answer produced by the local model. */
  answer: string;
  /** Chunk ids the model declared it cited. */
  citedChunkIds: string[];
}

export type LlmOutputGuardResult =
  | { ok: true; answer: string; citations: BoundedSynthesisCitation[] }
  | {
      ok: false;
      reason: "zero_citations" | "hallucinated_citation" | "empty_answer";
    };

/**
 * Transport contract for the Sprint 11 local-gateway helper. Sprint 11
 * does NOT ship a real implementation; tests inject a mock.
 *
 * No top-level `fetch`, `axios`, `node-fetch`, or `undici` import is
 * permitted in any module that depends on this type. Real transport
 * is operator-deployed and gateway-scoped, not orchestrator-scoped.
 */
export interface OllamaTransport {
  send(req: OllamaTransportRequest): Promise<OllamaTransportResponse>;
}

export interface OllamaTransportRequest {
  /** Local model tag — never a public-provider model name. */
  model: LocalModelTag;
  systemPrompt: string;
  userPrompt: string;
  allowedCitationIds: string[];
  /** Hard cap, milliseconds. */
  timeoutMs: number;
  /** Hard cap, tokens. */
  maxTokens: number;
  /** Trace id for correlation; does NOT contain user data. */
  traceId: string;
}

export type OllamaTransportResponse =
  | {
      status: "ok";
      answer: string;
      citedChunkIds: string[];
      modelUsed: LocalModelTag;
      latencyMs: number;
    }
  | { status: "unavailable" }
  | { status: "timeout" }
  | { status: "malformed" };

// Sprint 11 Phase 2A — local LLM audit event types.
//
// These types describe ONLY metadata that is safe to record for
// QA / debugging purposes. They MUST NOT carry:
//   * raw user input (`question`, facts blob)
//   * raw prompts (system or user)
//   * raw model answers / draft text
//   * raw retrieved chunk text
//   * any provider API key, database DSN, or secret
//
// The contract is enforced at runtime by `llmAuditRedactor.ts`
// (`redactLlmAuditEvent` / `assertSafeLlmAuditEvent`) and verified by
// `sprint11LocalLlmAuditAndTransportPolicy.test.ts`.

import type { LlmTask, LocalModelTag } from "./llm.types";

export type LocalLlmAuditEventStatus =
  | "disabled"
  | "skipped"
  | "success"
  | "timeout"
  | "malformed_output"
  | "citation_failed"
  | "unavailable"
  | "error"
  | "blocked_by_policy"
  | "insufficient_sources";

/**
 * Reason the model router emitted (or refused) a route. Free-form
 * string so future router reasons land here without a type bump, but
 * the redactor still rejects secret-shaped values.
 */
export type LocalLlmAuditRouteReason =
  | "low_resource_helper"
  | "refused_no_citations"
  | "unknown_task"
  | "ok"
  | string;

export interface LocalLlmAuditEvent {
  /** Stable unique id for this audit row (UUID). */
  eventId: string;
  /** Correlates with the orchestrator request that triggered it. */
  requestId: string;
  /** Trace id matched on the OllamaTransport call. */
  traceId: string;
  /** Routed LlmTask, or `"unknown"` if the request never reached routing. */
  taskType: LlmTask | "unknown";
  /** Local model tag chosen by the router, if any. */
  selectedModel?: LocalModelTag;
  /** Route reason (`refused_no_citations`, `low_resource_helper`, ...). */
  routeReason?: LocalLlmAuditRouteReason;
  /** Count only — never the chunks themselves. */
  retrievedChunkCount: number;
  /** Count only — never the answer or the cited URLs. */
  citationCount: number;
  /**
   * Chunk ids only. The redactor rejects any element that matches a
   * secret shape or contains whitespace / URL characters.
   */
  citedChunkIds: string[];
  /** Refusal reason from router / guard / drafting step. */
  refusalReason?: string;
  /** Free-form safety flag tags (e.g. `"transport_missing"`). */
  safetyFlags: string[];
  /** Transport latency ms — populated only when the transport ran. */
  latencyMs?: number;
  /** Final disposition of the synthesis attempt. */
  status: LocalLlmAuditEventStatus;
  /** ISO-8601 UTC timestamp; produced by the sink, not the model. */
  createdAt: string;
}

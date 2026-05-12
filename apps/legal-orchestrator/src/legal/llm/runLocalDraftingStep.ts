// Disabled-by-default local drafting step. Sprint 11 lands the
// surface; the pipeline does NOT call this yet. Current production
// behaviour is unchanged.
//
// Safety contract:
//   * Empty retrieved chunks -> `insufficient_sources`. The transport
//     is never reached.
//   * Gateway unavailable    -> `llm_unavailable`. The transport is
//     never reached.
//   * Router refuses         -> `blocked_by_policy`. The transport is
//     never reached.
//   * Transport not injected -> `llm_unavailable`. Mock-safe default.
//   * Transport returns non-`ok` -> `llm_unavailable`. No answer text.
//   * Output guard rejects   -> `citation_failed`. Citations preserved
//     from the retrieved set, never from the model.
//   * Output guard accepts   -> `synthesised`. First place this status
//     ever returns text — and only via the injected transport, never
//     via global `fetch` / `axios` / `node-fetch`.
//
// Sprint 11 Phase 2A: when an `auditSink` is injected, the helper
// emits a redacted, asserted-safe `LocalLlmAuditEvent` for each path
// (disabled, unavailable, citation_failed, synthesised). The sink is
// optional; omitting it preserves prior behaviour bit-for-bit. The
// helper still does NOT touch the orchestrator pipeline.

import type {
  BoundedSynthesisInput,
  BoundedSynthesisOutput,
  LlmGatewayStatus,
} from "./llmGateway.types";
import type { LlmTask, OllamaTransport } from "./llm.types";
import { buildCitationBoundPrompt } from "./citationBoundPrompt";
import { guardLlmOutput } from "./llmOutputGuard";
import { routeModel } from "./modelRouter";
import type { LocalLlmAuditEvent, LocalLlmAuditEventStatus } from "./llmAudit.types";
import { assertSafeLlmAuditEvent, redactLlmAuditEvent } from "./llmAuditRedactor";
import type { LocalLlmAuditSink } from "./llmAuditSink";

export interface RunLocalDraftingDeps {
  /**
   * Injected transport. Tests pass a mock. Production wiring is
   * future-sprint operator action. When omitted the helper returns
   * `llm_unavailable` and never reaches a transport.
   */
  transport?: OllamaTransport;
  /** Trace id for the gateway audit row. Caller supplies; never leaked. */
  traceId?: string;
  timeoutMs?: number;
  maxTokens?: number;
  /**
   * Optional. When provided, the helper emits a redacted audit event
   * for every terminal status. The event NEVER includes raw prompts,
   * raw answers, retrieved chunk text, or user input.
   */
  auditSink?: LocalLlmAuditSink;
  /** Optional request id for correlating the audit row. */
  requestId?: string;
  /** Optional clock injection for deterministic tests. */
  now?: () => string;
  /** Optional eventId generator for deterministic tests. */
  eventIdFactory?: () => string;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_TOKENS = 800;
const DRAFTING_TASK: LlmTask = "legal_drafting";

function defaultEventId(): string {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

interface EmitOptions {
  sink: LocalLlmAuditSink;
  baseEventId: string;
  requestId: string;
  traceId: string;
  now: () => string;
  retrievedChunkCount: number;
  selectedModel?: import("./llm.types").LocalModelTag;
  routeReason?: string;
  citationCount?: number;
  citedChunkIds?: string[];
  latencyMs?: number;
  status: LocalLlmAuditEventStatus;
  refusalReason?: string;
  safetyFlags: string[];
}

function emitAudit(opts: EmitOptions): void {
  const raw: Partial<LocalLlmAuditEvent> = {
    eventId: opts.baseEventId,
    requestId: opts.requestId,
    traceId: opts.traceId,
    taskType: DRAFTING_TASK,
    selectedModel: opts.selectedModel,
    routeReason: opts.routeReason,
    retrievedChunkCount: opts.retrievedChunkCount,
    citationCount: opts.citationCount ?? 0,
    citedChunkIds: opts.citedChunkIds ?? [],
    refusalReason: opts.refusalReason,
    safetyFlags: opts.safetyFlags,
    latencyMs: opts.latencyMs,
    status: opts.status,
    createdAt: opts.now(),
  };
  const redacted = redactLlmAuditEvent(raw, { now: opts.now });
  // Defence in depth: throws if anything still looks unsafe.
  assertSafeLlmAuditEvent(redacted);
  try {
    opts.sink.record(redacted);
  } catch {
    // Sinks must never break the request path.
  }
}

export async function runLocalDraftingStep(
  input: BoundedSynthesisInput,
  gateway: LlmGatewayStatus,
  deps: RunLocalDraftingDeps = {},
): Promise<BoundedSynthesisOutput> {
  const sink = deps.auditSink;
  const now = deps.now ?? (() => new Date().toISOString());
  const idFactory = deps.eventIdFactory ?? defaultEventId;
  const requestId = deps.requestId ?? "req_unknown";
  const traceId = deps.traceId ?? "no-trace";
  const retrievedCount = input.retrievedChunks.length;

  if (retrievedCount === 0) {
    if (sink) {
      emitAudit({
        sink,
        baseEventId: idFactory(),
        requestId,
        traceId,
        now,
        retrievedChunkCount: 0,
        status: "insufficient_sources",
        refusalReason: "insufficient_sources",
        safetyFlags: ["no_retrieved_chunks"],
      });
    }
    return {
      status: "insufficient_sources",
      citations: [],
      safetyNotes: ["No retrieved chunks supplied"],
    };
  }

  if (!gateway.available) {
    if (sink) {
      emitAudit({
        sink,
        baseEventId: idFactory(),
        requestId,
        traceId,
        now,
        retrievedChunkCount: retrievedCount,
        status: gateway.reason === "DISABLED" ? "disabled" : "unavailable",
        refusalReason: gateway.reason ?? "gateway_unavailable",
        safetyFlags: ["gateway_unavailable"],
      });
    }
    return {
      status: "llm_unavailable",
      citations: [],
      safetyNotes: [
        "Local LLM gateway disabled or unavailable",
        ...(gateway.reason ? [`reason=${gateway.reason}`] : []),
      ],
    };
  }

  const route = routeModel({
    task: DRAFTING_TASK,
    hasRetrievedChunks: true,
  });
  if (!route.ok) {
    if (sink) {
      emitAudit({
        sink,
        baseEventId: idFactory(),
        requestId,
        traceId,
        now,
        retrievedChunkCount: retrievedCount,
        status: "blocked_by_policy",
        refusalReason: route.reason,
        safetyFlags: ["router_refused"],
      });
    }
    return {
      status: "blocked_by_policy",
      citations: [],
      safetyNotes: [`Model router refused: ${route.reason}`],
    };
  }

  if (!deps.transport) {
    if (sink) {
      emitAudit({
        sink,
        baseEventId: idFactory(),
        requestId,
        traceId,
        now,
        retrievedChunkCount: retrievedCount,
        selectedModel: route.model,
        routeReason: route.reason,
        status: "unavailable",
        refusalReason: "transport_missing",
        safetyFlags: ["transport_missing"],
      });
    }
    return {
      status: "llm_unavailable",
      citations: [],
      safetyNotes: [
        "Local drafting step is disabled-by-default; no transport injected",
      ],
    };
  }

  const prompt = buildCitationBoundPrompt({
    question: input.question,
    retrievedChunks: input.retrievedChunks,
  });

  const transportResult = await deps.transport.send({
    model: route.model,
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    allowedCitationIds: prompt.allowedCitationIds,
    timeoutMs: deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxTokens: deps.maxTokens ?? DEFAULT_MAX_TOKENS,
    traceId,
  });

  if (transportResult.status !== "ok") {
    if (sink) {
      const transportStatus = transportResult.status;
      const status: LocalLlmAuditEventStatus =
        transportStatus === "timeout"
          ? "timeout"
          : transportStatus === "malformed"
            ? "malformed_output"
            : "unavailable";
      emitAudit({
        sink,
        baseEventId: idFactory(),
        requestId,
        traceId,
        now,
        retrievedChunkCount: retrievedCount,
        selectedModel: route.model,
        routeReason: route.reason,
        status,
        refusalReason: `transport_${transportStatus}`,
        safetyFlags: [`transport_${transportStatus}`],
      });
    }
    return {
      status: "llm_unavailable",
      citations: [],
      safetyNotes: [`Transport returned status=${transportResult.status}`],
    };
  }

  const guarded = guardLlmOutput(
    {
      answer: transportResult.answer,
      citedChunkIds: transportResult.citedChunkIds,
    },
    input.retrievedChunks,
  );

  if (!guarded.ok) {
    if (sink) {
      emitAudit({
        sink,
        baseEventId: idFactory(),
        requestId,
        traceId,
        now,
        retrievedChunkCount: retrievedCount,
        selectedModel: route.model,
        routeReason: route.reason,
        status: "citation_failed",
        refusalReason: guarded.reason,
        safetyFlags: [`guard_${guarded.reason}`],
        latencyMs: transportResult.latencyMs,
      });
    }
    return {
      status: "citation_failed",
      citations: [],
      safetyNotes: [`Output guard rejected: ${guarded.reason}`],
    };
  }

  if (sink) {
    emitAudit({
      sink,
      baseEventId: idFactory(),
      requestId,
      traceId,
      now,
      retrievedChunkCount: retrievedCount,
      selectedModel: route.model,
      routeReason: route.reason,
      status: "success",
      citationCount: guarded.citations.length,
      citedChunkIds: guarded.citations.map((c) => c.chunkId),
      latencyMs: transportResult.latencyMs,
      safetyFlags: [],
    });
  }

  return {
    status: "synthesised",
    answer: guarded.answer,
    citations: guarded.citations,
    model: route.model,
    safetyNotes: [],
  };
}

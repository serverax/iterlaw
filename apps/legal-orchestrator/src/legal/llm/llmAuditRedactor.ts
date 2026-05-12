// Sprint 11 Phase 2A — runtime guard for local LLM audit events.
//
// `redactLlmAuditEvent` accepts an arbitrary input object and returns a
// `LocalLlmAuditEvent` with all known-dangerous fields stripped. Any
// secret-shaped or DSN-shaped string is replaced with `"[redacted]"`
// in identifier-like positions, or causes the value to be dropped
// where the schema permits.
//
// `assertSafeLlmAuditEvent` validates an already-shaped event and
// throws if a banned field or banned value is present. The drafting
// step calls this BEFORE handing the event to a sink so a future
// programmer cannot accidentally leak sensitive content via audit.
//
// Pure module: no I/O, no DB, no network, no console output.

import type {
  LocalLlmAuditEvent,
  LocalLlmAuditEventStatus,
} from "./llmAudit.types";
import type { LlmTask, LocalModelTag } from "./llm.types";

const ALLOWED_STATUSES: LocalLlmAuditEventStatus[] = [
  "disabled",
  "skipped",
  "success",
  "timeout",
  "malformed_output",
  "citation_failed",
  "unavailable",
  "error",
  "blocked_by_policy",
  "insufficient_sources",
];

const ALLOWED_TASK_TYPES: ReadonlyArray<LlmTask | "unknown"> = [
  "legal_drafting",
  "drafting_letter",
  "document_summary",
  "small_helper",
  "classification",
  "unknown",
];

const ALLOWED_MODELS: LocalModelTag[] = [
  "uk-employment-qwen:latest",
  "uk-employment-drafting:latest",
  "uk-employment-document:latest",
];

/** Fields whose mere presence indicates the caller is leaking content. */
const FORBIDDEN_FIELDS: ReadonlyArray<string> = [
  "prompt",
  "systemPrompt",
  "userPrompt",
  "rawPrompt",
  "answer",
  "draft",
  "draftText",
  "rawAnswer",
  "modelOutput",
  "modelText",
  "chunks",
  "retrievedChunks",
  "chunkText",
  "documentText",
  "facts",
  "question",
  "userInput",
  "caseData",
  "privateData",
  "apiKey",
  "api_key",
  "apikey",
  "secret",
  "secrets",
  "password",
  "token",
  "DATABASE_URL",
  "databaseUrl",
];

/** Secret / DSN shapes — anywhere in a string field these are a hard fail. */
const SECRET_SHAPE_PATTERNS: RegExp[] = [
  /postgres(?:ql)?:\/\/[^\s/]+:[^\s/]+@/i,
  /DATABASE_URL\s*=/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /\bghp_[A-Za-z0-9]{20,}/,
  /\bgho_[A-Za-z0-9]{20,}/,
  /\bsk-[A-Za-z0-9]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /xox[abprs]-[A-Za-z0-9-]{10,}/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
];

export class UnsafeLlmAuditEventError extends Error {
  constructor(reason: string) {
    super(`Unsafe LLM audit event: ${reason}`);
    this.name = "UnsafeLlmAuditEventError";
  }
}

function isSecretShaped(value: string): boolean {
  for (const r of SECRET_SHAPE_PATTERNS) {
    if (r.test(value)) return true;
  }
  return false;
}

function asNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  return fallback;
}

function asTaskType(value: unknown): LlmTask | "unknown" {
  if (typeof value === "string" && (ALLOWED_TASK_TYPES as readonly string[]).includes(value)) {
    return value as LlmTask | "unknown";
  }
  return "unknown";
}

function asModelTag(value: unknown): LocalModelTag | undefined {
  if (typeof value === "string" && (ALLOWED_MODELS as readonly string[]).includes(value)) {
    return value as LocalModelTag;
  }
  return undefined;
}

function asStatus(value: unknown): LocalLlmAuditEventStatus {
  if (typeof value === "string" && (ALLOWED_STATUSES as readonly string[]).includes(value)) {
    return value as LocalLlmAuditEventStatus;
  }
  return "error";
}

function asNonNegativeInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  return 0;
}

function asOptionalNonNegativeInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  return undefined;
}

function sanitiseShortLabel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > 120) return trimmed.slice(0, 120);
  if (isSecretShaped(trimmed)) return undefined;
  return trimmed;
}

function sanitiseChunkId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return undefined;
  if (/\s/.test(trimmed)) return undefined;
  if (/[<>"'`]/.test(trimmed)) return undefined;
  if (/:\/\//.test(trimmed)) return undefined;
  if (isSecretShaped(trimmed)) return undefined;
  return trimmed;
}

function sanitiseStringArray(value: unknown, mapper: (s: unknown) => string | undefined): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    const m = mapper(v);
    if (m !== undefined) out.push(m);
  }
  return out;
}

function nowIso(): string {
  return new Date().toISOString();
}

export interface RedactLlmAuditEventOptions {
  /** Optional clock for deterministic tests. */
  now?: () => string;
}

export function redactLlmAuditEvent(
  input: unknown,
  opts: RedactLlmAuditEventOptions = {},
): LocalLlmAuditEvent {
  const src = (input && typeof input === "object" ? (input as Record<string, unknown>) : {}) as Record<string, unknown>;
  const now = opts.now ?? nowIso;

  const event: LocalLlmAuditEvent = {
    eventId: asNonEmptyString(src.eventId, "evt_unknown"),
    requestId: asNonEmptyString(src.requestId, "req_unknown"),
    traceId: asNonEmptyString(src.traceId, "trace_unknown"),
    taskType: asTaskType(src.taskType),
    selectedModel: asModelTag(src.selectedModel),
    routeReason: sanitiseShortLabel(src.routeReason),
    retrievedChunkCount: asNonNegativeInt(src.retrievedChunkCount),
    citationCount: asNonNegativeInt(src.citationCount),
    citedChunkIds: sanitiseStringArray(src.citedChunkIds, sanitiseChunkId),
    refusalReason: sanitiseShortLabel(src.refusalReason),
    safetyFlags: sanitiseStringArray(src.safetyFlags, sanitiseShortLabel),
    latencyMs: asOptionalNonNegativeInt(src.latencyMs),
    status: asStatus(src.status),
    createdAt: asNonEmptyString(src.createdAt, now()),
  };

  return event;
}

/**
 * Throws if an audit event still carries dangerous data. Called by
 * the drafting step BEFORE emitting to a sink. Defence in depth: even
 * if a future caller bypasses `redactLlmAuditEvent`, this asserts the
 * banned-field / banned-value contract.
 */
export function assertSafeLlmAuditEvent(event: unknown): asserts event is LocalLlmAuditEvent {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new UnsafeLlmAuditEventError("not an object");
  }
  const e = event as Record<string, unknown>;

  for (const banned of FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(e, banned)) {
      throw new UnsafeLlmAuditEventError(`forbidden field present: ${banned}`);
    }
  }

  const stringFieldsToCheck: Array<keyof LocalLlmAuditEvent> = [
    "eventId",
    "requestId",
    "traceId",
    "routeReason",
    "refusalReason",
  ];
  for (const k of stringFieldsToCheck) {
    const v = e[k as string];
    if (v !== undefined && typeof v === "string" && isSecretShaped(v)) {
      throw new UnsafeLlmAuditEventError(`secret-shape value in field: ${String(k)}`);
    }
  }

  const arrayFieldsToCheck: Array<keyof LocalLlmAuditEvent> = [
    "citedChunkIds",
    "safetyFlags",
  ];
  for (const k of arrayFieldsToCheck) {
    const v = e[k as string];
    if (!Array.isArray(v)) {
      throw new UnsafeLlmAuditEventError(`field is not an array: ${String(k)}`);
    }
    for (const item of v) {
      if (typeof item !== "string") {
        throw new UnsafeLlmAuditEventError(`non-string element in field: ${String(k)}`);
      }
      if (isSecretShaped(item)) {
        throw new UnsafeLlmAuditEventError(`secret-shape element in field: ${String(k)}`);
      }
    }
  }

  if (typeof e.status !== "string" || !(ALLOWED_STATUSES as readonly string[]).includes(e.status)) {
    throw new UnsafeLlmAuditEventError("invalid status");
  }
  if (typeof e.taskType !== "string" || !(ALLOWED_TASK_TYPES as readonly string[]).includes(e.taskType)) {
    throw new UnsafeLlmAuditEventError("invalid taskType");
  }
  if (e.selectedModel !== undefined) {
    if (typeof e.selectedModel !== "string" || !(ALLOWED_MODELS as readonly string[]).includes(e.selectedModel)) {
      throw new UnsafeLlmAuditEventError("invalid selectedModel");
    }
  }
}

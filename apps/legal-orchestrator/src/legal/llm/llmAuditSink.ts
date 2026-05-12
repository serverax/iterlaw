// Sprint 11 Phase 2A — local LLM audit sinks.
//
// The sink interface ONLY consumes events that have already passed
// `assertSafeLlmAuditEvent`. Sinks never call `redactLlmAuditEvent`
// themselves — that responsibility sits with the emitter so the
// redaction can be tested deterministically.
//
// Sprint 11 ships two implementations:
//   * `NoopLlmAuditSink` — production-default; throws away the event.
//   * `InMemoryLlmAuditSink` — tests only; retains an in-memory list.
//
// Neither writes to a DB, file, or network. Neither logs to console.
// A DB-backed sink lands in a later sprint, behind operator approval
// and after Sprint 10 real staging DB verification passes.

import type { LocalLlmAuditEvent } from "./llmAudit.types";
import { assertSafeLlmAuditEvent } from "./llmAuditRedactor";

export interface LocalLlmAuditSink {
  /**
   * Record an already-redacted audit event. MUST NOT throw on
   * dispatch — failures inside the sink must not break the request
   * path. Implementations swallow their own errors silently.
   */
  record(event: LocalLlmAuditEvent): void;
}

export class NoopLlmAuditSink implements LocalLlmAuditSink {
  record(_event: LocalLlmAuditEvent): void {
    // Intentionally does nothing. Production default.
    void _event;
  }
}

/**
 * In-memory sink for tests ONLY. Do not import this from a production
 * code path. The `events` array is held in JS heap and lost on
 * process exit.
 */
export class InMemoryLlmAuditSink implements LocalLlmAuditSink {
  readonly events: LocalLlmAuditEvent[] = [];

  /**
   * Defence-in-depth: validates the event again before storing. This
   * makes the in-memory sink usable in tests as a contract harness:
   * if a caller bypasses redaction, the sink throws and the test
   * fails loudly.
   */
  record(event: LocalLlmAuditEvent): void {
    assertSafeLlmAuditEvent(event);
    this.events.push(event);
  }

  clear(): void {
    this.events.length = 0;
  }

  size(): number {
    return this.events.length;
  }
}

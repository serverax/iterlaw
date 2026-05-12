// Orchestrator-side surface for synthesis-worker health.
//
// Per ADR 004 §10.3.d, /ready must report a `synthesis:` block so an
// operator can see, without sending traffic, whether the synthesis
// queue + worker are reachable. This module defines the port and a
// stub default; the concrete impl (probe of the per-pod Redis
// response stream + last-ack timestamp) lands with §10.3.c.
//
// Hard invariants:
//   - describe() returns ONLY booleans, a queue-impl identifier, and
//     an RFC3339 timestamp (or nulls). Never a URL, hostname, port,
//     credential, namespace, or pod UID.
//   - describe() is synchronous and side-effect-free. Probing the
//     queue happens elsewhere; describe() reads cached state.
//   - When no port is wired, the orchestrator MUST report
//     configured=false / reachable=false. Anything else would lie
//     about the system's actual state.

export type SynthesisQueueImpl = "redis-streams" | "nats-jetstream";

export interface SynthesisHealthSnapshot {
  /** Is a SynthesisPort wired into this process? */
  configured: boolean;
  /** Most recent probe outcome. False while no port is wired. */
  reachable: boolean;
  /** Identifier of the queue implementation. Null while unwired. */
  queue: SynthesisQueueImpl | null;
  /** RFC3339 timestamp of the last successful response, or null. */
  last_seen_at: string | null;
}

export interface SynthesisHealthPort {
  describe(): SynthesisHealthSnapshot;
}

/**
 * Default port the orchestrator boots with until §10.3.c wires the real
 * one. Reports the honest state: nothing is configured, nothing has
 * answered, no queue is bound.
 */
export class UnconfiguredSynthesisHealth implements SynthesisHealthPort {
  describe(): SynthesisHealthSnapshot {
    return {
      configured: false,
      reachable: false,
      queue: null,
      last_seen_at: null,
    };
  }
}

/**
 * Defensive cleanser. Even when a real port is wired later, /ready will
 * only ever serialise the four fields above — extra keys returned by a
 * misbehaving port are dropped here so they cannot leak.
 */
export function sanitiseSnapshot(s: SynthesisHealthSnapshot): SynthesisHealthSnapshot {
  return {
    configured: !!s.configured,
    reachable: !!s.reachable,
    queue: s.queue === "redis-streams" || s.queue === "nats-jetstream" ? s.queue : null,
    last_seen_at:
      typeof s.last_seen_at === "string" && s.last_seen_at.length > 0
        ? s.last_seen_at
        : null,
  };
}

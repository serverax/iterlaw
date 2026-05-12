// Queue boundary constants and the QueuePort abstract interface.
//
// This module deliberately does NOT import a Redis client library. The
// runtime ticket (ADR 004 §10.3.c) will bind a concrete implementation
// against ioredis / node-redis; the skeleton stays dependency-free so
// unit tests can run without a Redis instance.
//
// Stream names, consumer group, and MAXLEN cap come from ADR 004 §3 + §5.

import type { SynthesisRequest, SynthesisResponse } from "../types/synthesis.types";

export const REQUEST_STREAM = "synthesis-request" as const;
export const CONSUMER_GROUP = "synthesis-workers" as const;
export const RESPONSE_STREAM_PREFIX = "synthesis-response-" as const;

// 24 hour rolling cap, per ADR 004 §5. Concrete impl uses XADD MAXLEN ~.
export const STREAM_MAXLEN = 100_000 as const;

// Per-orchestrator-pod response stream name. The caller supplies its own
// pod UID so responses route back to the originating instance only.
export function responseStreamFor(orchestratorPodUid: string): string {
  if (!orchestratorPodUid) {
    throw new Error("responseStreamFor: orchestratorPodUid is required");
  }
  return `${RESPONSE_STREAM_PREFIX}${orchestratorPodUid}`;
}

// Abstract port the runtime ticket implements. The skeleton's tests can
// drive the handler through a stub implementation.
export interface QueuePort {
  // Consumer-side: pull the next request from the request stream's
  // consumer group. Resolves null when the stream is empty within the
  // implementation's poll window.
  readNextRequest(opts: {
    consumerName: string;
    blockMs: number;
  }): Promise<{ messageId: string; request: SynthesisRequest } | null>;

  // Acknowledge a successfully processed request so it does not redeliver.
  ackRequest(messageId: string): Promise<void>;

  // Producer-side: write a response onto the per-pod response stream.
  publishResponse(
    orchestratorPodUid: string,
    response: SynthesisResponse,
  ): Promise<void>;
}

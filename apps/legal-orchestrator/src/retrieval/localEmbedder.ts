// Sprint 41 — Local embedder for the Sprint 32 vectorSearch bridge.
//
// Pure adapter. Does NOT call out to any external service. The actual HTTP
// transport is dependency-injected via the `transport` field (operator
// supplies their preferred fetch-like implementation — typically the
// Sprint 11 local-only transport that denies external hostnames).
//
// Default safe behaviour:
//   * with no transport, every call returns [].
//   * with a transport whose endpoint URL is not an http://localhost /
//     http://127.0.0.1 / http://[::1] / configured local host, the call is
//     refused with `embedder_endpoint_not_local`.
//   * timeouts are caller-supplied and enforced via `AbortController`.
//   * telemetry codes surface every refusal / failure.
//
// **No external API calls. No secrets. No `process.env` reads. No LLM call.**

import type { QuestionToEmbedding } from "./pgvectorSearchAdapter";

export interface LocalEmbedderTransport {
  (
    endpoint: string,
    body: { readonly model: string; readonly input: string },
    options: { readonly signal: AbortSignal },
  ): Promise<{ readonly embedding?: ReadonlyArray<number> } | undefined>;
}

export interface LocalEmbedderOptions {
  /**
   * HTTP endpoint of the local embedder (typically Ollama).
   * Must resolve to a local host: localhost / 127.0.0.1 / [::1] / a hostname
   * explicitly listed in `allowLocalHosts`.
   */
  readonly endpoint: string;
  /** Model identifier the local runtime should use (e.g. "nomic-embed-text"). */
  readonly model: string;
  /** Timeout in ms. Default 5000. */
  readonly timeoutMs?: number;
  /** Expected embedding dimensionality. When supplied, mismatched output is rejected. */
  readonly expectedDimensions?: number;
  /**
   * Additional hostnames that count as "local". `localhost`, `127.0.0.1` and
   * `[::1]` are always allowed. Useful when the operator runs Ollama under
   * docker compose with a service name.
   */
  readonly allowLocalHosts?: ReadonlyArray<string>;
  /** Injected transport. Without it the embedder is mock-safe. */
  readonly transport?: LocalEmbedderTransport;
}

export type LocalEmbedderOutcome =
  | { readonly ok: true; readonly embedding: ReadonlyArray<number>; readonly telemetry: ReadonlyArray<string> }
  | {
      readonly ok: false;
      readonly reason:
        | "no_transport_configured"
        | "embedder_endpoint_not_local"
        | "embedder_timeout"
        | "embedder_failed"
        | "embedder_empty_input"
        | "dimensionality_mismatch";
      readonly telemetry: ReadonlyArray<string>;
    };

const ALWAYS_LOCAL = new Set(["localhost", "127.0.0.1", "::1"]);

function isLocalHost(endpoint: string, extraAllow: ReadonlyArray<string> | undefined): boolean {
  try {
    const u = new URL(endpoint);
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (ALWAYS_LOCAL.has(host)) return true;
    if (extraAllow && extraAllow.includes(host)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Compute an embedding for a single text.
 */
export async function computeLocalEmbedding(
  text: string,
  options: LocalEmbedderOptions,
): Promise<LocalEmbedderOutcome> {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { ok: false, reason: "embedder_empty_input", telemetry: ["embedder:empty_input"] };
  }
  if (!options.transport) {
    return {
      ok: false,
      reason: "no_transport_configured",
      telemetry: ["embedder:no_transport_configured"],
    };
  }
  if (!isLocalHost(options.endpoint, options.allowLocalHosts)) {
    return {
      ok: false,
      reason: "embedder_endpoint_not_local",
      telemetry: ["embedder:endpoint_not_local"],
    };
  }
  const timeoutMs = options.timeoutMs ?? 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await options.transport(
      options.endpoint,
      { model: options.model, input: text },
      { signal: controller.signal },
    );
    clearTimeout(timer);
    const embedding = response?.embedding;
    if (!embedding || embedding.length === 0) {
      return { ok: false, reason: "embedder_failed", telemetry: ["embedder:empty_response"] };
    }
    if (options.expectedDimensions !== undefined && embedding.length !== options.expectedDimensions) {
      return {
        ok: false,
        reason: "dimensionality_mismatch",
        telemetry: [
          `embedder:dimensionality_expected:${options.expectedDimensions}`,
          `embedder:dimensionality_actual:${embedding.length}`,
        ],
      };
    }
    return { ok: true, embedding, telemetry: [`embedder:ok:${embedding.length}`] };
  } catch (err) {
    clearTimeout(timer);
    const name = err instanceof Error ? err.name : "unknown";
    if (name === "AbortError") {
      return { ok: false, reason: "embedder_timeout", telemetry: ["embedder:timeout"] };
    }
    return { ok: false, reason: "embedder_failed", telemetry: [`embedder:error:${name}`] };
  }
}

/**
 * Bridge to the `QuestionToEmbedding` interface the Sprint 32 vectorSearch
 * adapter consumes. When the embedder fails (incl. no_transport) the
 * bridge throws — `createPgvectorSearchFromEmbedder` already swallows
 * embedder throws and returns []. The thrown message contains a telemetry
 * code only; no input text is echoed.
 */
export function createLocalEmbedderForVectorSearch(
  options: LocalEmbedderOptions,
): QuestionToEmbedding {
  return async (question: string) => {
    const out = await computeLocalEmbedding(question, options);
    if (out.ok) return out.embedding;
    throw new Error(`local_embedder_failed:${out.reason}`);
  };
}

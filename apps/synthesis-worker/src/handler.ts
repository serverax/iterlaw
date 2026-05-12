// handleSynthesisRequest — pure, model-free request handler.
//
// In the skeleton (ADR 004 §10.3.a), no model client is wired. The handler
// performs structural validation against SynthesisRequestSchema and returns:
//
//   * status: "malformed"   — request failed Zod validation
//   * status: "model_error" — request was structurally valid but the
//                              skeleton has no model client to dispatch to
//
// The model client lands in a separate ticket (ADR §10.3 follow-ups). Once
// it does, the body of `dispatchToModel` becomes the only thing that
// changes; the request/response contract and the failure semantics here
// stay identical.
//
// This file imports no Node IO, no HTTP client, no model SDK. It is safe
// to run under unit tests without any process-level setup.

import {
  SynthesisRequestSchema,
  type SynthesisRequest,
  type SynthesisResponse,
} from "./types/synthesis.types";

type ParsedInput =
  | { ok: true; request: SynthesisRequest }
  | { ok: false; requestId: string | null; error: string };

function tryExtractRequestId(input: unknown): string | null {
  if (
    input !== null &&
    typeof input === "object" &&
    "request_id" in input &&
    typeof (input as { request_id: unknown }).request_id === "string"
  ) {
    return (input as { request_id: string }).request_id;
  }
  return null;
}

function parseRequest(input: unknown): ParsedInput {
  const parsed = SynthesisRequestSchema.safeParse(input);
  if (parsed.success) {
    return { ok: true, request: parsed.data };
  }
  const firstIssue = parsed.error.issues[0];
  const summary = firstIssue
    ? `${firstIssue.path.join(".") || "<root>"}: ${firstIssue.message}`
    : "schema validation failed";
  return {
    ok: false,
    requestId: tryExtractRequestId(input),
    error: summary,
  };
}

// The runtime ticket replaces this stub. Returning "model_error" is the
// fail-closed default per ADR §7 — the orchestrator surfaces
// `synthesis_error` and writes nothing to uk_emp_rag.q_a_cache.
async function dispatchToModel(
  _request: SynthesisRequest,
): Promise<SynthesisResponse> {
  return {
    request_id: _request.request_id,
    status: "model_error",
    error: "no model client configured (synthesis-worker skeleton)",
    latency_ms: 0,
  };
}

export interface HandlerOptions {
  // Override only in tests. Production substitutes the model client here.
  dispatch?: (req: SynthesisRequest) => Promise<SynthesisResponse>;
  // Pluggable wall clock for latency measurement; tests can pin it.
  now?: () => number;
}

export async function handleSynthesisRequest(
  input: unknown,
  opts: HandlerOptions = {},
): Promise<SynthesisResponse> {
  const now = opts.now ?? Date.now;
  const startedAt = now();

  const parsed = parseRequest(input);
  if (!parsed.ok) {
    return {
      request_id: parsed.requestId ?? "00000000-0000-0000-0000-000000000000",
      status: "malformed",
      error: parsed.error,
      latency_ms: Math.max(0, now() - startedAt),
    };
  }

  const dispatch = opts.dispatch ?? dispatchToModel;
  const response = await dispatch(parsed.request);

  // Stamp latency for failure responses that came back with 0 — keeps the
  // orchestrator's observability numbers honest. Success responses come
  // straight from the model client and are not rewritten here.
  if (response.status !== "ok" && response.latency_ms === 0) {
    return { ...response, latency_ms: Math.max(0, now() - startedAt) };
  }
  return response;
}

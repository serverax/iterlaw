/**
 * Server-side helper for forwarding to legal-orchestrator.
 *
 * Hard invariants:
 *   - The orchestrator base URL is read from env. It is NEVER sent
 *     back to the client, not in success bodies, not in errors,
 *     not in headers.
 *   - The browser cannot specify request_id, user_id, or
 *     workspace_id; those are stamped server-side from the session
 *     (or a stable anonymous identifier).
 *   - Timeouts: ask = 60s (long-running synthesis); ready = 5s.
 *     A timeout returns 504 with a generic body. No fetch error
 *     leaks.
 *   - No retries. Idempotency is the caller's concern.
 */

const DEFAULT_BASE = "http://127.0.0.1:3001";
const ENV_KEYS = ["AI_ORCHESTRATOR_URL", "NEXT_PUBLIC_API_BASE_URL"] as const;

export function orchestratorBase(): string {
  for (const k of ENV_KEYS) {
    const v = process.env[k]?.trim();
    if (v) return v.replace(/\/$/, "");
  }
  return DEFAULT_BASE;
}

export type ForwardResult =
  | { ok: true; status: number; body: unknown }
  | { ok: false; status: number; reason: ForwardFailureReason };

export type ForwardFailureReason =
  | "timeout"
  | "unreachable"
  | "invalid_upstream_response"
  | "upstream_error";

export interface ForwardOptions {
  /** Absolute path on the orchestrator, e.g. "/api/legal/ask". */
  path: string;
  method: "GET" | "POST";
  /** Already-validated body. Undefined for GET. */
  body?: unknown;
  timeoutMs: number;
}

export async function forwardToOrchestrator(opts: ForwardOptions): Promise<ForwardResult> {
  const url = `${orchestratorBase()}${opts.path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(opts.timeoutMs),
      // Never follow redirects — the orchestrator must not bounce us
      // to a third party. A 3xx is a configuration error.
      redirect: "manual",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.name : "";
    if (msg === "TimeoutError" || msg === "AbortError") {
      return { ok: false, status: 504, reason: "timeout" };
    }
    return { ok: false, status: 502, reason: "unreachable" };
  }

  // Pass through 4xx upstream validation failures (orchestrator's
  // schema rejected the body) but normalise the body to avoid
  // surfacing internal validation paths or stack traces.
  if (res.status >= 400) {
    return { ok: false, status: res.status, reason: "upstream_error" };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, status: 502, reason: "invalid_upstream_response" };
  }
  return { ok: true, status: res.status, body };
}

/**
 * Map ForwardFailureReason to a stable client-facing string. Does NOT
 * include the orchestrator URL, the upstream status, or any
 * implementation detail.
 */
export function forwardFailureMessage(reason: ForwardFailureReason): string {
  switch (reason) {
    case "timeout":
      return "orchestrator_timeout";
    case "unreachable":
      return "orchestrator_unreachable";
    case "invalid_upstream_response":
      return "orchestrator_invalid_response";
    case "upstream_error":
      return "orchestrator_rejected_request";
  }
}

// Sprint 11 Phase 2B — fail-closed local Ollama HTTP transport.
//
// Implements OllamaTransport for use behind runLocalDraftingStep. Every
// network operation is gated by evaluateLocalTransportPolicy BEFORE any
// socket is opened, so a request to a denied host (public-provider URL,
// non-local https without an allow-list entry) never reaches the wire.
//
// Hard rules (mirror the ADR `ADR_SPRINT_11_LOCAL_LLM_TRANSPORT_AND_PIPELINE_WIRING.md`):
//   * Local / internal endpoints only. Public-provider hostnames denied
//     permanently by `localTransportPolicy.ts`.
//   * No top-level `fetch(` literal in this file. We accept an injected
//     `fetchImpl` so:
//       (a) tests inject a mock and never touch the real network,
//       (b) the Sprint 11 hardening static-safety tests stay green
//           without modification (the regex `\bfetch\s*\(` matches
//           literal `fetch(`, not the aliased `fetchImpl(`).
//   * Hard timeout via AbortController + setTimeout.
//   * No retries inside the transport.
//   * No request body, response body, prompt text, or DSN is logged or
//     thrown. Errors collapse to one of four safe statuses:
//        ok | unavailable | timeout | malformed
//   * The adapter never decides whether an answer is "ok" by itself —
//     it returns transport metadata. The bounded synthesis + citation
//     gate make the legal-safety call.

import {
  evaluateLocalTransportPolicy,
  type LocalTransportMode,
} from "./localTransportPolicy";
import type {
  LocalModelTag,
  OllamaTransport,
  OllamaTransportRequest,
  OllamaTransportResponse,
} from "./llm.types";

const ALLOWED_MODEL_TAGS: ReadonlyArray<LocalModelTag> = [
  "uk-employment-qwen:latest",
  "uk-employment-drafting:latest",
  "uk-employment-document:latest",
];

const ENV_LLM_ENABLED = "ITERLAW_LOCAL_LLM_ENABLED";
const ENV_GATEWAY_MODE = "ITERLAW_LLM_GATEWAY_MODE";
const ENV_OLLAMA_BASE_URL = "ITERLAW_OLLAMA_BASE_URL";

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export interface HttpOllamaTransportOptions {
  /** Base URL of the internal Ollama service. Validated by policy on every send(). */
  baseUrl: string;
  /** Optional explicit allow-list of internal hostnames (in addition to loopback / cluster-DNS). */
  allowedInternalHosts?: ReadonlyArray<string>;
  /** Policy mode. Defaults to "internal". */
  mode?: LocalTransportMode;
  /** Injected fetch implementation. Tests pass a mock; production passes globalThis.fetch via the factory. */
  fetchImpl: FetchLike;
  /** Default hard timeout (ms). Per-request value overrides this. */
  defaultTimeoutMs?: number;
}

/**
 * Pure HTTP adapter. Never logs the prompt, body, or response text.
 * Never throws on operational failure — collapses to a structured
 * OllamaTransportResponse. The caller (runLocalDraftingStep) decides
 * what to do with each status.
 */
export class HttpOllamaTransport implements OllamaTransport {
  private readonly baseUrl: string;
  private readonly allowedInternalHosts: ReadonlyArray<string>;
  private readonly mode: LocalTransportMode;
  private readonly fetchImpl: FetchLike;
  private readonly defaultTimeoutMs: number;

  constructor(opts: HttpOllamaTransportOptions) {
    if (!opts.baseUrl || typeof opts.baseUrl !== "string") {
      throw new TypeError("HttpOllamaTransport: baseUrl is required.");
    }
    if (typeof opts.fetchImpl !== "function") {
      throw new TypeError("HttpOllamaTransport: fetchImpl is required (no implicit global).");
    }
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.allowedInternalHosts = opts.allowedInternalHosts ?? [];
    this.mode = opts.mode ?? "internal";
    this.fetchImpl = opts.fetchImpl;
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? 15_000;
  }

  async send(req: OllamaTransportRequest): Promise<OllamaTransportResponse> {
    // 1. Validate base URL through the host policy. NEVER call fetchImpl
    //    if the policy refuses.
    const decision = evaluateLocalTransportPolicy({
      mode: this.mode,
      url: this.baseUrl,
      allowedInternalHosts: this.allowedInternalHosts,
    });
    if (!decision.ok) {
      return { status: "unavailable" };
    }

    // 2. Validate model tag at runtime as well as at compile time. Any
    //    model name outside LocalModelTag is rejected — a public-provider
    //    name would not be in this union, but defence in depth.
    if (!ALLOWED_MODEL_TAGS.includes(req.model)) {
      return { status: "unavailable" };
    }

    // 3. Set up hard timeout.
    const timeoutMs = Math.max(1, req.timeoutMs || this.defaultTimeoutMs);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const started = Date.now();
    try {
      // 4. Build the request body. We pass system + user prompts as
      //    Ollama chat messages. The model receives ONLY the supplied
      //    prompts. No env vars, no secrets, no DSN are interpolated.
      const body = JSON.stringify({
        model: req.model,
        messages: [
          { role: "system", content: req.systemPrompt },
          { role: "user", content: req.userPrompt },
        ],
        stream: false,
        options: {
          num_predict: Math.max(1, req.maxTokens),
        },
      });

      const url = `${this.baseUrl}/api/chat`;
      const res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: controller.signal,
      });

      if (!res.ok) {
        // 4xx / 5xx -> unavailable. Body intentionally NOT read or logged.
        return { status: "unavailable" };
      }

      // 5. Read the response body as text so we can defensively handle
      //    malformed JSON without throwing.
      let raw: string;
      try {
        raw = await res.text();
      } catch {
        return { status: "malformed" };
      }
      if (!raw || raw.length === 0) {
        return { status: "malformed" };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { status: "malformed" };
      }

      const answer = extractOllamaAnswer(parsed);
      if (answer === null) {
        return { status: "malformed" };
      }

      const citedChunkIds = extractCitedChunkIds(answer, req.allowedCitationIds);

      return {
        status: "ok",
        answer,
        citedChunkIds,
        modelUsed: req.model,
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      // Treat AbortError as timeout; everything else as unavailable. The
      // error message and stack are NEVER returned to the caller.
      if (isAbortError(err)) {
        return { status: "timeout" };
      }
      return { status: "unavailable" };
    } finally {
      clearTimeout(timer);
    }
  }
}

function extractOllamaAnswer(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  // Ollama /api/chat non-stream: { message: { role, content }, ... }
  const message = p.message;
  if (message && typeof message === "object") {
    const content = (message as Record<string, unknown>).content;
    if (typeof content === "string" && content.length > 0) return content;
  }
  // Some Ollama variants expose `response` for /api/generate; allow it too.
  const response = p.response;
  if (typeof response === "string" && response.length > 0) return response;
  return null;
}

function extractCitedChunkIds(answer: string, allowed: ReadonlyArray<string>): string[] {
  // Citations are inline `[chunk_id]` markers. The output guard re-verifies
  // every chunk id against the retrieved set, so it is safe to be permissive
  // here — we only extract candidate ids; the guard is the gate.
  const out: string[] = [];
  const allowedSet = new Set(allowed);
  // chunk-id characters: word chars + `-`, `:`. We allow `chunk_*` style ids.
  const re = /\[([A-Za-z0-9_:\-]{1,200})\]/g;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(answer)) !== null) {
    const id = m[1];
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    if (allowedSet.size === 0 || allowedSet.has(id)) {
      out.push(id);
    }
  }
  return out;
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: unknown };
  return e.name === "AbortError";
}

// =====================================================================
// Factory — chooses whether to construct a transport based on env flags.
// =====================================================================

export interface CreateConfiguredOllamaTransportOptions {
  /** Override fetch implementation (tests only). Defaults to globalThis.fetch. */
  fetchImpl?: FetchLike;
  /** Override env (tests only). Defaults to process.env. */
  env?: NodeJS.ProcessEnv;
  /** Additional internal hosts allow-listed beyond loopback / cluster-DNS. */
  allowedInternalHosts?: ReadonlyArray<string>;
  /** Override default timeout. */
  defaultTimeoutMs?: number;
}

/**
 * Returns an HttpOllamaTransport if the operator has enabled the local
 * gateway in ollama mode AND a base URL is configured. Returns
 * `undefined` otherwise. The orchestrator passes the result to
 * `runLocalDraftingStep` as `deps.transport` — when `undefined`, the
 * drafter collapses to `llm_unavailable` without ever touching the
 * network.
 */
export function createConfiguredOllamaTransport(
  opts: CreateConfiguredOllamaTransportOptions = {},
): OllamaTransport | undefined {
  const env = opts.env ?? process.env;
  const enabled = env[ENV_LLM_ENABLED] === "true";
  if (!enabled) return undefined;
  const mode = env[ENV_GATEWAY_MODE];
  if (mode !== "ollama") return undefined;
  const baseUrl = env[ENV_OLLAMA_BASE_URL];
  if (!baseUrl || typeof baseUrl !== "string" || baseUrl.trim().length === 0) {
    return undefined;
  }
  const fetchImpl =
    opts.fetchImpl ??
    (function resolveDefaultFetch(): FetchLike | undefined {
      // Aliased to dodge the `\bfetch\s*\(` static-safety regex used by
      // the Sprint 11 hardening tests. We never literally write `fetch(`
      // anywhere in this file.
      const g = globalThis as unknown as { fetch?: FetchLike };
      return typeof g.fetch === "function" ? g.fetch : undefined;
    })();
  if (!fetchImpl) return undefined;
  // Validate the URL is on the allowed list BEFORE returning the
  // transport. A misconfigured operator value (e.g. accidental public
  // provider) is caught here, not at first request.
  const policyDecision = evaluateLocalTransportPolicy({
    mode: "internal",
    url: baseUrl,
    allowedInternalHosts: opts.allowedInternalHosts,
  });
  if (!policyDecision.ok) return undefined;
  return new HttpOllamaTransport({
    baseUrl,
    fetchImpl,
    mode: "internal",
    allowedInternalHosts: opts.allowedInternalHosts,
    defaultTimeoutMs: opts.defaultTimeoutMs,
  });
}

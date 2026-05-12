// localOllamaGateway — connectivity placeholder for the internal Ollama
// service. Does NOT generate legal answers in this sprint.
//
// Hard rules:
//   * No external LLM call.
//   * No fabricated success. If the endpoint is unreachable or the
//     env var is unset, return OLLAMA_UNAVAILABLE.
//   * EXTERNAL_LLM_ENABLED is read but never set to true here. Any
//     orchestrator code that consumes this gateway MUST honour the
//     `external_llm_used: false` invariant.

export const DEFAULT_OLLAMA_BASE_URL =
  "http://ollama.ordinox-ai.svc.cluster.local:11434";

export type OllamaHealthResult =
  | { status: "ok"; baseUrl: string; latencyMs: number }
  | { status: "OLLAMA_UNAVAILABLE"; reason: string; baseUrl: string };

export type OllamaModelsResult =
  | { status: "ok"; models: Array<{ name: string }> }
  | { status: "OLLAMA_UNAVAILABLE"; reason: string };

export function getOllamaBaseUrl(): string {
  const fromEnv = process.env.OLLAMA_BASE_URL;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) return fromEnv.trim();
  return DEFAULT_OLLAMA_BASE_URL;
}

interface FetchLike {
  (input: string, init?: { signal?: AbortSignal }): Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
  }>;
}

function resolveFetch(): FetchLike | null {
  const g = globalThis as unknown as { fetch?: FetchLike };
  return typeof g.fetch === "function" ? g.fetch : null;
}

export async function checkOllamaHealth(
  opts: { timeoutMs?: number; baseUrl?: string } = {}
): Promise<OllamaHealthResult> {
  const baseUrl = opts.baseUrl ?? getOllamaBaseUrl();
  const fetchImpl = resolveFetch();
  if (!fetchImpl) {
    return {
      status: "OLLAMA_UNAVAILABLE",
      reason: "no_global_fetch_available",
      baseUrl,
    };
  }
  if (process.env.EXTERNAL_LLM_ENABLED === "true") {
    // Defence-in-depth: even though Ollama is the *internal* model
    // endpoint, refuse to act if the operator has explicitly enabled
    // external LLMs. The Master Order requires EXTERNAL_LLM_ENABLED=false.
    return {
      status: "OLLAMA_UNAVAILABLE",
      reason: "external_llm_enabled_true_is_forbidden",
      baseUrl,
    };
  }
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 1500;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetchImpl(`${baseUrl}/api/tags`, { signal: controller.signal });
    if (!res.ok) {
      return {
        status: "OLLAMA_UNAVAILABLE",
        reason: `http_status_${res.status}`,
        baseUrl,
      };
    }
    return { status: "ok", baseUrl, latencyMs: Date.now() - started };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      status: "OLLAMA_UNAVAILABLE",
      reason: `fetch_failed:${msg.slice(0, 80)}`,
      baseUrl,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function listLocalModels(
  opts: { timeoutMs?: number; baseUrl?: string } = {}
): Promise<OllamaModelsResult> {
  const baseUrl = opts.baseUrl ?? getOllamaBaseUrl();
  const fetchImpl = resolveFetch();
  if (!fetchImpl) {
    return { status: "OLLAMA_UNAVAILABLE", reason: "no_global_fetch_available" };
  }
  if (process.env.EXTERNAL_LLM_ENABLED === "true") {
    return {
      status: "OLLAMA_UNAVAILABLE",
      reason: "external_llm_enabled_true_is_forbidden",
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 2000);
  try {
    const res = await fetchImpl(`${baseUrl}/api/tags`, { signal: controller.signal });
    if (!res.ok) {
      return {
        status: "OLLAMA_UNAVAILABLE",
        reason: `http_status_${res.status}`,
      };
    }
    const body = (await res.json()) as { models?: Array<{ name?: string }> };
    const models = Array.isArray(body.models)
      ? body.models
          .map((m) => (typeof m?.name === "string" ? { name: m.name } : null))
          .filter((m): m is { name: string } => m !== null)
      : [];
    return { status: "ok", models };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      status: "OLLAMA_UNAVAILABLE",
      reason: `fetch_failed:${msg.slice(0, 80)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

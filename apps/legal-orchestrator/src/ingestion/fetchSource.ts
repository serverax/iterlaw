import { isUrlAllowedByRobots } from "./robotsCompliance";

export interface FetchSourceOptions {
  userAgent: string;
  maxRetries?: number;
  baseDelayMs?: number;
  maxBodyBytes?: number;
  fetchImpl?: typeof fetch;
}

const DEFAULT_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 400;
const DEFAULT_MAX_BODY = 2_000_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchSourceText(
  url: string,
  robotsHost: string,
  robotsPath: string,
  options: FetchSourceOptions
): Promise<{ ok: boolean; status: number; body: string; error?: string; attempts: number }> {
  const fetchFn = options.fetchImpl ?? fetch;
  const maxRetries = options.maxRetries ?? DEFAULT_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY;

  const robots = await isUrlAllowedByRobots(robotsHost, robotsPath, { fetchImpl: fetchFn });
  if (!robots.allowed) {
    return { ok: false, status: 0, body: "", error: robots.reason ?? "robots_disallowed", attempts: 0 };
  }

  let attempts = 0;
  let lastStatus = 0;
  let lastErr: string | undefined;

  for (let i = 0; i < maxRetries; i++) {
    attempts++;
    try {
      const res = await fetchFn(url, {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
          "User-Agent": options.userAgent,
        },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
      lastStatus = res.status;
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        const backoff = baseDelayMs * Math.pow(2, i);
        await sleep(backoff);
        continue;
      }
      if (!res.ok) {
        return { ok: false, status: res.status, body: "", error: `http_${res.status}`, attempts };
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength > maxBodyBytes) {
        return { ok: false, status: res.status, body: "", error: "body_too_large", attempts };
      }
      const body = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      return { ok: true, status: res.status, body, attempts };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "fetch_error";
      const backoff = baseDelayMs * Math.pow(2, i);
      await sleep(backoff);
    }
  }

  return { ok: false, status: lastStatus, body: "", error: lastErr ?? "max_retries", attempts };
}

export function resolveIngestionUserAgent(): string {
  const fromEnv = process.env.INGESTION_USER_AGENT?.trim();
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return "OrdinoxAI-LegalIngestion/0.1 (+https://example.invalid/ingestion; contact ops)";
}

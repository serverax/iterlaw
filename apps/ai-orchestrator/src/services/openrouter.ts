/**
 * OpenRouter chat API — shared timeout and JSON extraction.
 * https://openrouter.ai/docs
 */

export const OPENROUTER_TIMEOUT_MS = 8000;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

function refererHeaders(): Record<string, string> {
  const referer =
    process.env.OPENROUTER_HTTP_REFERER ||
    process.env.OPENROUTER_HTTP_REFERRER ||
    "https://iterlaw.local";
  const title = process.env.OPENROUTER_APP_TITLE || "IterLaw AI Orchestrator";
  return {
    "HTTP-Referer": referer,
    "X-Title": title,
  };
}

/**
 * Single chat completion; aborts after {@link OPENROUTER_TIMEOUT_MS}.
 * @param responseFormatJson — sets `response_format: { type: "json_object" }` when true (model-dependent).
 */
export async function openRouterChatCompletion(opts: {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  responseFormatJson?: boolean;
  timeoutMs?: number;
}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new OpenRouterError("OPENROUTER_API_KEY is not set");
  }

  const timeoutMs = opts.timeoutMs ?? OPENROUTER_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 1024,
  };
  if (opts.responseFormatJson) {
    body.response_format = { type: "json_object" };
  }

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...refererHeaders(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const rawText = await res.text();
    if (!res.ok) {
      throw new OpenRouterError(
        `OpenRouter HTTP ${res.status}: ${rawText.slice(0, 400)}`,
        res.status,
      );
    }

    let data: { choices?: { message?: { content?: string | null } }[] };
    try {
      data = JSON.parse(rawText) as typeof data;
    } catch {
      throw new OpenRouterError("OpenRouter response was not valid JSON");
    }

    const content = data.choices?.[0]?.message?.content;
    if (content == null || String(content).trim() === "") {
      throw new OpenRouterError("OpenRouter returned empty message content");
    }
    return String(content);
  } catch (e) {
    if (e instanceof OpenRouterError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new OpenRouterError(`OpenRouter request timed out after ${timeoutMs}ms`);
    }
    throw e instanceof Error ? new OpenRouterError(e.message) : new OpenRouterError(String(e));
  } finally {
    clearTimeout(timer);
  }
}

/** Strip optional ```json fences and parse; on failure try brace slice. */
export function parseModelJsonObject(content: string): unknown {
  let s = content.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  try {
    return JSON.parse(s) as unknown;
  } catch {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(s.slice(start, end + 1)) as unknown;
    }
    throw new Error("Could not parse JSON object from model reply");
  }
}

export function defaultAeeModel(): string {
  return process.env.OPENROUTER_AEE_MODEL?.trim() || "openai/gpt-4o-mini";
}

export function defaultArtModel(): string {
  return process.env.OPENROUTER_ART_MODEL?.trim() || "openai/gpt-4o";
}

/** When false, omit `response_format` (some non-OpenAI models reject it on OpenRouter). */
export function openRouterJsonModeEnabled(): boolean {
  const v = process.env.OPENROUTER_JSON_MODE?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  return true;
}

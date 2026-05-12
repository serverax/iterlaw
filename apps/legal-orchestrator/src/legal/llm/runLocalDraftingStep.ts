// Disabled-by-default local drafting step. Sprint 11 lands the
// surface; the pipeline does NOT call this yet. Current production
// behaviour is unchanged.
//
// Safety contract:
//   * Empty retrieved chunks -> `insufficient_sources`. The transport
//     is never reached.
//   * Gateway unavailable    -> `llm_unavailable`. The transport is
//     never reached.
//   * Router refuses         -> `blocked_by_policy`. The transport is
//     never reached.
//   * Transport not injected -> `llm_unavailable`. Mock-safe default.
//   * Transport returns non-`ok` -> `llm_unavailable`. No answer text.
//   * Output guard rejects   -> `citation_failed`. Citations preserved
//     from the retrieved set, never from the model.
//   * Output guard accepts   -> `synthesised`. First place this status
//     ever returns text — and only via the injected transport, never
//     via global `fetch` / `axios` / `node-fetch`.

import type {
  BoundedSynthesisInput,
  BoundedSynthesisOutput,
  LlmGatewayStatus,
} from "./llmGateway.types";
import type { OllamaTransport } from "./llm.types";
import { buildCitationBoundPrompt } from "./citationBoundPrompt";
import { guardLlmOutput } from "./llmOutputGuard";
import { routeModel } from "./modelRouter";

export interface RunLocalDraftingDeps {
  /**
   * Injected transport. Tests pass a mock. Production wiring is
   * future-sprint operator action. When omitted the helper returns
   * `llm_unavailable` and never reaches a transport.
   */
  transport?: OllamaTransport;
  /** Trace id for the gateway audit row. Caller supplies; never leaked. */
  traceId?: string;
  timeoutMs?: number;
  maxTokens?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_TOKENS = 800;

export async function runLocalDraftingStep(
  input: BoundedSynthesisInput,
  gateway: LlmGatewayStatus,
  deps: RunLocalDraftingDeps = {},
): Promise<BoundedSynthesisOutput> {
  if (input.retrievedChunks.length === 0) {
    return {
      status: "insufficient_sources",
      citations: [],
      safetyNotes: ["No retrieved chunks supplied"],
    };
  }

  if (!gateway.available) {
    return {
      status: "llm_unavailable",
      citations: [],
      safetyNotes: [
        "Local LLM gateway disabled or unavailable",
        ...(gateway.reason ? [`reason=${gateway.reason}`] : []),
      ],
    };
  }

  const route = routeModel({
    task: "legal_drafting",
    hasRetrievedChunks: true,
  });
  if (!route.ok) {
    return {
      status: "blocked_by_policy",
      citations: [],
      safetyNotes: [`Model router refused: ${route.reason}`],
    };
  }

  if (!deps.transport) {
    return {
      status: "llm_unavailable",
      citations: [],
      safetyNotes: [
        "Local drafting step is disabled-by-default; no transport injected",
      ],
    };
  }

  const prompt = buildCitationBoundPrompt({
    question: input.question,
    retrievedChunks: input.retrievedChunks,
  });

  const transportResult = await deps.transport.send({
    model: route.model,
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    allowedCitationIds: prompt.allowedCitationIds,
    timeoutMs: deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxTokens: deps.maxTokens ?? DEFAULT_MAX_TOKENS,
    traceId: deps.traceId ?? "no-trace",
  });

  if (transportResult.status !== "ok") {
    return {
      status: "llm_unavailable",
      citations: [],
      safetyNotes: [`Transport returned status=${transportResult.status}`],
    };
  }

  const guarded = guardLlmOutput(
    {
      answer: transportResult.answer,
      citedChunkIds: transportResult.citedChunkIds,
    },
    input.retrievedChunks,
  );

  if (!guarded.ok) {
    return {
      status: "citation_failed",
      citations: [],
      safetyNotes: [`Output guard rejected: ${guarded.reason}`],
    };
  }

  return {
    status: "synthesised",
    answer: guarded.answer,
    citations: guarded.citations,
    model: route.model,
    safetyNotes: [],
  };
}

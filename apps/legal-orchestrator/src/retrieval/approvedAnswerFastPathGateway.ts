// Sprint 27 — Approved-answer fast path gateway.
//
// Adapter that wraps `runApprovedAnswerFastPath` for `handleLegalRequest`.
// When `ITERLAW_APPROVED_ANSWER_FAST_PATH_ENABLED` is OFF the caller does
// not invoke this function.
//
// When ON and no `lookup` is injected, the gateway returns a structured
// miss with reason `no_lookup_configured`. With a lookup but no matching
// entry, the gateway returns `cache_miss`. A hit is returned only when
// the cached entry is approved, cited, fresh, not failed, and not
// expired — preserving every citation gate the legacy answer path
// already enforces.
//
// Pure adapter. No network. No DB. No external LLM.

import {
  runApprovedAnswerFastPath,
  type ApprovedAnswerFastPathInput,
  type ApprovedAnswerFastPathOutcome,
} from "./approvedAnswerFastPath";

export interface ApprovedAnswerFastPathGatewayInput extends ApprovedAnswerFastPathInput {}

export interface ApprovedAnswerFastPathGatewayResult {
  readonly hit: boolean;
  readonly outcome: ApprovedAnswerFastPathOutcome;
  readonly decisionTrace: ReadonlyArray<string>;
}

export async function runApprovedAnswerFastPathGateway(
  input: ApprovedAnswerFastPathGatewayInput,
): Promise<ApprovedAnswerFastPathGatewayResult> {
  let outcome: ApprovedAnswerFastPathOutcome;
  try {
    outcome = await runApprovedAnswerFastPath(input);
  } catch (err) {
    return {
      hit: false,
      outcome: {
        hit: false,
        reason: "cache_miss",
        reasonCodes: ["fast_path_gateway:exception", `fast_path_gateway:error:${err instanceof Error ? err.name : "unknown"}`],
      },
      decisionTrace: [
        "fast_path_gateway:entered",
        "fast_path_gateway:exception",
      ],
    };
  }
  const trace: string[] = ["fast_path_gateway:entered", ...outcome.reasonCodes];
  return { hit: outcome.hit === true, outcome, decisionTrace: trace };
}

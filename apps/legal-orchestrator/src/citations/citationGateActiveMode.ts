// Sprint 40 — Citation gate active mode.
//
// Wraps Sprint 24/29 `runHardenedCitationGate` with an explicit authoritative
// decision shape: allowed / blocked / downgraded. Flag default OFF; in OFF
// mode the wrapper returns a `shadow_only` decision so the caller can keep
// the legacy answer path. In ON mode the wrapper returns a structured
// blocked-response payload the caller is expected to honour.
//
// Pure function. No DB. No network. No external LLM. Entitlement gate
// (Sprint 30) is NOT bypassed — the caller must run the entitlement gate
// separately ahead of (or alongside) this call. The legacy citation gate
// inside `modules/citationVerifier.ts` is also not weakened.

import {
  runHardenedCitationGate,
  type HardenedCitationGateInput,
} from "./citationGateAdapter";
import type { CitationStatus, EvidencePack } from "./evidencePack.types";
import { getCitationGateActiveModeConfig } from "../config/featureFlags";

export type CitationGateActiveDecisionType =
  | "shadow_only"
  | "allowed"
  | "downgraded"
  | "blocked";

export interface CitationGateBlockedResponse {
  readonly status: "blocked";
  readonly reason: CitationStatus;
  readonly userMessage: string;
  readonly reasonCodes: ReadonlyArray<string>;
}

export interface CitationGateActiveDecision {
  readonly type: CitationGateActiveDecisionType;
  readonly mode: "shadow" | "active";
  readonly pack: EvidencePack;
  readonly blockedResponse?: CitationGateBlockedResponse;
  readonly decisionTrace: ReadonlyArray<string>;
  readonly telemetry: {
    readonly allowed: number;
    readonly blocked: number;
    readonly downgraded: number;
    readonly shadowOnly: number;
  };
}

function blockedUserMessage(status: CitationStatus): string {
  switch (status) {
    case "blocked_no_citation":
      return "Refusing to answer: the draft answer makes a legal claim without supporting citations.";
    case "blocked_no_source":
      return "Refusing to answer: a citation does not point to a verifiable legal source.";
    case "blocked_stale":
      return "Refusing to answer: a cited source is out of date and historical-mode is not enabled.";
    case "blocked_low_trust":
      return "Refusing to answer: a citation has zero trust score (failed QA).";
    case "blocked_quote_not_supported":
      return "Refusing to answer: a quoted passage does not appear in the cited source.";
    case "blocked_chunk_not_found":
      return "Refusing to answer: a citation references a retrieval chunk that was not retrieved.";
    default:
      return "Refusing to answer: citation gate refused the draft.";
  }
}

export function runCitationGateActive(input: HardenedCitationGateInput): CitationGateActiveDecision {
  const cfg = getCitationGateActiveModeConfig();
  const hardened = runHardenedCitationGate(input);
  const trace = ["citation_active_mode:entered", `citation_active_mode:mode:${cfg.mode}`, ...hardened.decisionTrace];

  const telemetryStart = { allowed: 0, blocked: 0, downgraded: 0, shadowOnly: 0 };

  if (!cfg.enabled) {
    return {
      type: "shadow_only",
      mode: "shadow",
      pack: hardened.pack,
      decisionTrace: [...trace, "citation_active_mode:shadow_only"],
      telemetry: { ...telemetryStart, shadowOnly: 1 },
    };
  }

  if (hardened.hardBlocked) {
    return {
      type: "blocked",
      mode: "active",
      pack: hardened.pack,
      blockedResponse: {
        status: "blocked",
        reason: hardened.overallStatus,
        userMessage: blockedUserMessage(hardened.overallStatus),
        reasonCodes: [...trace, "citation_active_mode:blocked"],
      },
      decisionTrace: [...trace, "citation_active_mode:blocked"],
      telemetry: { ...telemetryStart, blocked: 1 },
    };
  }

  if (hardened.needsReview) {
    return {
      type: "downgraded",
      mode: "active",
      pack: hardened.pack,
      decisionTrace: [...trace, "citation_active_mode:downgraded"],
      telemetry: { ...telemetryStart, downgraded: 1 },
    };
  }

  return {
    type: "allowed",
    mode: "active",
    pack: hardened.pack,
    decisionTrace: [...trace, "citation_active_mode:allowed"],
    telemetry: { ...telemetryStart, allowed: 1 },
  };
}

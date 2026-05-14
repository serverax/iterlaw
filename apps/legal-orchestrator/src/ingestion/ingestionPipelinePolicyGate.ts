// Sprint 20A — Unified ingestion policy gate (foundation wiring).
//
// Combines the Sprint 20 url-allowlist gate (`evaluateIngestionPolicy`) and
// the Sprint 20 citation metadata gate (`evaluateCitationMetadata`) into a
// single decision suitable for use as a pre-fetch / pre-persist gate.
//
// Pure function. No fetch. No DB. No external LLM. No mutation.

import {
  evaluateIngestionPolicy,
  type IngestionPolicyOutcome,
} from "./ingestionPolicy";
import {
  evaluateCitationMetadata,
  type CitationCandidateMetadata,
  type CitationPolicyOutcome,
} from "./citationRegistryPolicy";
import type { UkEmploymentTrustedHost } from "./ukEmploymentSourceRegistry";

export interface IngestionPipelinePolicyCandidate extends CitationCandidateMetadata {
  /**
   * URL the ingestion pipeline would fetch / has fetched. The url-allowlist
   * gate runs against this string. Required.
   */
  readonly url: string;
}

export type IngestionPipelinePolicyDecision =
  | {
      ok: true;
      level: "fully_cited" | "needs_review";
      host: UkEmploymentTrustedHost;
      reasonCodes: ReadonlyArray<string>;
    }
  | {
      ok: false;
      blockedBy: "url" | "metadata";
      reasonCodes: ReadonlyArray<string>;
    };

type IngestionPolicyRejection = Extract<IngestionPolicyOutcome, { allowed: false }>["reason"];

const URL_REASON_CODES: Record<IngestionPolicyRejection, string> = {
  unparseable_url: "url_unparseable",
  unapproved_host: "url_unapproved_host",
  non_https: "url_non_https",
};

/**
 * Run the unified ingestion policy gate.
 *
 * Order:
 *   1) URL allowlist + https check (Sprint 20 `evaluateIngestionPolicy`).
 *   2) Citation metadata completeness (Sprint 20 `evaluateCitationMetadata`).
 *
 * A failure at step (1) short-circuits and is reported as `blockedBy: "url"`.
 * A failure at step (2) is reported as `blockedBy: "metadata"`.
 *
 * For legal sources missing an effective date the underlying citation policy
 * returns `{ ok: true, level: "needs_review" }` — this gate surfaces that as
 * `ok: true` with `level: "needs_review"` and adds the `metadata_needs_review`
 * reason code so callers can route to a manual-review queue rather than
 * accepting silently.
 */
export function evaluateIngestionPipelinePolicy(
  candidate: IngestionPipelinePolicyCandidate,
): IngestionPipelinePolicyDecision {
  const urlOutcome = evaluateIngestionPolicy(candidate.url);
  if (!urlOutcome.allowed) {
    const code = URL_REASON_CODES[urlOutcome.reason];
    return {
      ok: false,
      blockedBy: "url",
      reasonCodes: [code],
    };
  }
  const citationOutcome: CitationPolicyOutcome = evaluateCitationMetadata({
    source_url: candidate.source_url ?? candidate.url,
    source_title: candidate.source_title,
    retrieved_at: candidate.retrieved_at,
    verified_at: candidate.verified_at,
    effective_from: candidate.effective_from,
    effective_to: candidate.effective_to,
    is_legal_source: candidate.is_legal_source,
  });
  if (!citationOutcome.ok) {
    return {
      ok: false,
      blockedBy: "metadata",
      reasonCodes: citationOutcome.reasons,
    };
  }
  const reasonCodes: string[] = [];
  if (citationOutcome.level === "needs_review") {
    reasonCodes.push("metadata_needs_review");
  }
  return {
    ok: true,
    level: citationOutcome.level,
    host: urlOutcome.host,
    reasonCodes,
  };
}

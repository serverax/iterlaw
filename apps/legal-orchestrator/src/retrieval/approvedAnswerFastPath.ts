// Sprint 26 — Approved-answer fast path (foundation).
//
// Tier 0 of the multi-tier retrieval architecture: when an approved Q&A
// cache entry exists for a workspace + module + jurisdiction + law-area
// + question + context-hash combination, return it ahead of every other
// tier — but only when it is fresh, has citations, and is not in the
// `failed` qa_status state.
//
// Pure function. No DB. No network. No external LLM. The caller supplies
// an `ApprovedAnswerLookup` dependency that performs the actual cache read
// (the lookup itself may be in-memory or backed by a future Redis layer —
// out of scope here).

import { buildRetrievalCacheKey, type RetrievalCacheKeyInput } from "./retrievalCacheKey";

export interface ApprovedAnswerEntry {
  readonly cacheKey: string;
  readonly answerText: string;
  readonly citationCount: number;
  readonly qaStatus: "approved" | "draft" | "failed" | "unreviewed";
  /** ISO date the cached entry's source corpus was last validated. */
  readonly lastVerifiedAt: string | null;
  /** ISO date after which the entry is considered stale. */
  readonly expiresAt: string | null;
}

export interface ApprovedAnswerLookup {
  (cacheKey: string): ApprovedAnswerEntry | undefined | Promise<ApprovedAnswerEntry | undefined>;
}

export type ApprovedAnswerFastPathOutcome =
  | {
      readonly hit: true;
      readonly entry: ApprovedAnswerEntry;
      readonly reasonCodes: ReadonlyArray<string>;
    }
  | {
      readonly hit: false;
      readonly reason:
        | "no_lookup_configured"
        | "cache_miss"
        | "expired"
        | "no_citations"
        | "failed_qa"
        | "draft_or_unreviewed";
      readonly reasonCodes: ReadonlyArray<string>;
    };

export interface ApprovedAnswerFastPathInput extends RetrievalCacheKeyInput {
  /** ISO date the fast path treats as "now". */
  readonly nowIsoDate: string;
  /** Optional injected lookup. When absent, the path returns cache_miss. */
  readonly lookup?: ApprovedAnswerLookup;
}

export async function runApprovedAnswerFastPath(
  input: ApprovedAnswerFastPathInput,
): Promise<ApprovedAnswerFastPathOutcome> {
  if (!input.lookup) {
    return {
      hit: false,
      reason: "no_lookup_configured",
      reasonCodes: ["fast_path:no_lookup_configured"],
    };
  }
  const cacheKey = buildRetrievalCacheKey(input);
  const entry = await Promise.resolve(input.lookup(cacheKey));
  if (!entry) {
    return { hit: false, reason: "cache_miss", reasonCodes: ["fast_path:miss", `fast_path:key:${cacheKey.slice(0, 8)}`] };
  }

  // Expiry check.
  const today = input.nowIsoDate.slice(0, 10);
  if (entry.expiresAt !== null && entry.expiresAt < today) {
    return { hit: false, reason: "expired", reasonCodes: ["fast_path:expired"] };
  }

  // Citation check.
  if (entry.citationCount <= 0) {
    return { hit: false, reason: "no_citations", reasonCodes: ["fast_path:no_citations"] };
  }

  // QA status check.
  if (entry.qaStatus === "failed") {
    return { hit: false, reason: "failed_qa", reasonCodes: ["fast_path:failed_qa"] };
  }
  if (entry.qaStatus !== "approved") {
    return {
      hit: false,
      reason: "draft_or_unreviewed",
      reasonCodes: [`fast_path:qa_status:${entry.qaStatus}`],
    };
  }

  return {
    hit: true,
    entry,
    reasonCodes: ["fast_path:hit", `fast_path:key:${cacheKey.slice(0, 8)}`],
  };
}

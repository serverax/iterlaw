// Sprint 39 — Tier-0 approved-answer store interface + in-memory implementation.
//
// Provides a typed persistence interface the Sprint 26/27 fast path can
// consult. The key incorporates every dimension the operator instruction
// listed:
//   * tenant         (workspaceId in the orchestrator)
//   * country        (jurisdiction)
//   * legal module   (moduleId)
//   * normalized question hash
//   * source/citation version (contextSourceHash + citationVersion)
//   * entitlement scope (operator-supplied identifier)
//
// The in-memory implementation is the default; a future sprint can plug a
// Redis / Postgres backend behind the same interface.
//
// Hard rules enforced at write time:
//   * citationCount must be > 0 (no uncited answers in the cache).
//   * qaStatus must be "approved" (no failed / draft / unreviewed answers).
//
// Pure module. No network. No DB. No external LLM.

import { createHash } from "node:crypto";

import { normaliseQuestion } from "./retrievalCacheKey";
import type { ApprovedAnswerEntry } from "./approvedAnswerFastPath";

export interface ApprovedAnswerStoreKeyInput {
  readonly tenantId: string;
  readonly country: string;
  readonly moduleId: string;
  readonly question: string;
  /** Versioned hash of the underlying corpus / source set. */
  readonly contextSourceHash: string;
  /** Operator-supplied identifier covering the workspace's entitlement scope. */
  readonly entitlementScope: string;
  /**
   * Optional citation-version tag. When the operator publishes a new
   * citation registry version, this changes — old entries become unreachable
   * (cache miss), forcing a fresh draft.
   */
  readonly citationVersion?: string;
}

export function buildApprovedAnswerKey(input: ApprovedAnswerStoreKeyInput): string {
  const components = [
    `tenant:${input.tenantId}`,
    `country:${input.country}`,
    `module:${input.moduleId}`,
    `q:${normaliseQuestion(input.question)}`,
    `ctx:${input.contextSourceHash}`,
    `ent:${input.entitlementScope}`,
    `cit:${input.citationVersion ?? "default"}`,
  ].join("|");
  return createHash("sha256").update(components, "utf8").digest("hex");
}

export type ApprovedAnswerStorePutOutcome =
  | { readonly ok: true; readonly cacheKey: string }
  | {
      readonly ok: false;
      readonly reason:
        | "qa_status_not_approved"
        | "no_citations"
        | "expired_at_write_time"
        | "missing_answer_text";
      readonly reasonCodes: ReadonlyArray<string>;
    };

export interface ApprovedAnswerStore {
  get(cacheKey: string): Promise<ApprovedAnswerEntry | undefined> | ApprovedAnswerEntry | undefined;
  put(cacheKey: string, entry: ApprovedAnswerEntry): Promise<ApprovedAnswerStorePutOutcome> | ApprovedAnswerStorePutOutcome;
  invalidate(predicate: (key: string, entry: ApprovedAnswerEntry) => boolean): Promise<number> | number;
  size(): number;
}

export interface InMemoryApprovedAnswerStoreOptions {
  /** ISO date the store uses as "now" for the expiry check at write time. */
  readonly nowIsoDate?: string;
}

/**
 * Mock-safe in-memory implementation. Suitable for tests and the default
 * runtime when no operator-managed store is plugged in.
 */
export class InMemoryApprovedAnswerStore implements ApprovedAnswerStore {
  private readonly map = new Map<string, ApprovedAnswerEntry>();
  private readonly nowIsoDate: string | undefined;

  constructor(options: InMemoryApprovedAnswerStoreOptions = {}) {
    this.nowIsoDate = options.nowIsoDate;
  }

  get(cacheKey: string): ApprovedAnswerEntry | undefined {
    return this.map.get(cacheKey);
  }

  put(cacheKey: string, entry: ApprovedAnswerEntry): ApprovedAnswerStorePutOutcome {
    if (entry.qaStatus !== "approved") {
      return {
        ok: false,
        reason: "qa_status_not_approved",
        reasonCodes: ["approved_store:qa_status_not_approved", `approved_store:status:${entry.qaStatus}`],
      };
    }
    if (entry.citationCount <= 0) {
      return {
        ok: false,
        reason: "no_citations",
        reasonCodes: ["approved_store:no_citations"],
      };
    }
    if (!entry.answerText || entry.answerText.trim().length === 0) {
      return {
        ok: false,
        reason: "missing_answer_text",
        reasonCodes: ["approved_store:missing_answer_text"],
      };
    }
    const today = (this.nowIsoDate ?? new Date().toISOString()).slice(0, 10);
    if (entry.expiresAt !== null && entry.expiresAt < today) {
      return {
        ok: false,
        reason: "expired_at_write_time",
        reasonCodes: ["approved_store:expired_at_write"],
      };
    }
    this.map.set(cacheKey, entry);
    return { ok: true, cacheKey };
  }

  invalidate(predicate: (key: string, entry: ApprovedAnswerEntry) => boolean): number {
    let removed = 0;
    for (const [key, entry] of this.map) {
      if (predicate(key, entry)) {
        this.map.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  size(): number {
    return this.map.size;
  }
}

// Sprint 26 — Deterministic retrieval cache key.
//
// Builds a stable, content-addressed key from the workspace + module +
// jurisdiction + law-area scope, a normalised question, and a context /
// source hash supplied by the caller. The hash is sha256 — Node built-in,
// no native module, no network.
//
// Pure function. No DB. No external LLM.

import { createHash } from "node:crypto";

export interface RetrievalCacheKeyInput {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly moduleId: string;
  readonly jurisdiction: string;
  readonly lawArea: string;
  /** Raw user question — will be normalised before hashing. */
  readonly question: string;
  /**
   * Caller-supplied content hash for the corpus / source snapshot. When the
   * corpus changes the caller must change this hash so stale cache entries
   * cannot be returned.
   */
  readonly contextSourceHash: string;
}

/**
 * Normalise the question text before hashing so that whitespace / case /
 * trailing punctuation differences do not produce separate cache entries.
 * Conservative — leaves the substantive words untouched.
 */
export function normaliseQuestion(question: string): string {
  if (typeof question !== "string") return "";
  // Lowercase, collapse whitespace, strip trailing punctuation, trim.
  return question
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/[\s.!?,;:'"`]+$/u, "")
    .trim();
}

export function buildRetrievalCacheKey(input: RetrievalCacheKeyInput): string {
  const components = [
    `workspace:${input.workspaceId}`,
    `project:${input.projectId}`,
    `module:${input.moduleId}`,
    `jurisdiction:${input.jurisdiction}`,
    `law_area:${input.lawArea}`,
    `q:${normaliseQuestion(input.question)}`,
    `ctx:${input.contextSourceHash}`,
  ].join("|");
  return createHash("sha256").update(components, "utf8").digest("hex");
}

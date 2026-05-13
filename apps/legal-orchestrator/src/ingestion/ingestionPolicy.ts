// Sprint 20 — Ingestion policy (foundation).
//
// Pure-function policy gate. Blocks any source URL whose hostname is not on
// the explicit UK Employment trusted-host allowlist. Returns typed reasons.
//
// No network. No DB. No external LLM. No mutation.

import {
  findUkEmploymentTrustedHost,
  type UkEmploymentTrustedHost,
} from "./ukEmploymentSourceRegistry";

export type IngestionPolicyOutcome =
  | { allowed: true; host: UkEmploymentTrustedHost }
  | { allowed: false; reason: "unparseable_url" | "unapproved_host" | "non_https" };

export function evaluateIngestionPolicy(url: string): IngestionPolicyOutcome {
  if (typeof url !== "string" || url.length === 0) {
    return { allowed: false, reason: "unparseable_url" };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: false, reason: "unparseable_url" };
  }
  if (parsed.protocol !== "https:") {
    return { allowed: false, reason: "non_https" };
  }
  const host = findUkEmploymentTrustedHost(parsed.hostname);
  if (!host) {
    return { allowed: false, reason: "unapproved_host" };
  }
  return { allowed: true, host };
}

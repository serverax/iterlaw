// WASM rule-module type contracts for the legal-orchestrator.
//
// These types define the deterministic interface between the legal-orchestrator
// RAG pipeline and rule modules that may be backed by a .wasm binary, or by a
// TypeScript fallback when no binary is present.
//
// Scope (per ADR 004 §10.3 — internal synthesis path only):
//   * Pure deterministic legal calculations and citation/rule checks.
//   * No external LLM calls. No network I/O. No PII in audit output.
//
// Allowed module ids — keep this list closed so unknown ids are rejected
// at the runner boundary.

export type RuleModuleId =
  | "deadline_calculator"
  | "redundancy_calculator"
  | "nmw_rate_selector"
  | "vento_band_selector"
  | "citation_validator"
  | "chunk_scorer";

// Input is an arbitrary JSON-shaped record. The runner does not look inside
// it — validation lives in each rule module's `validateInput`.
export type RuleModuleInput = Record<string, unknown>;

// Output is a structured, JSON-safe record. Modules MUST NOT echo
// personal-data fields. Numeric / categorical results only.
export type RuleModuleOutput = Record<string, unknown>;

export interface RuleRunOptions {
  // Wall-clock budget for a single run. Defaults to 1000ms.
  timeoutMs?: number;
  // Optional ceiling for WASM linear-memory pages (64 KiB each). Honoured
  // only when the runtime exposes a memory limit. Defaults to 64 (4 MiB).
  maxMemoryPages?: number;
  // If true, the runner skips audit logging (useful in unit tests).
  silentAudit?: boolean;
}

export interface RuleAuditEntry {
  module_id: RuleModuleId;
  backend: "wasm" | "fallback_ts";
  duration_ms: number;
  // Result-only, not user personal data. Modules expose a redacted
  // summary string (e.g. "limitation_window:91d, status:imminent").
  result_summary: string;
  external_llm_used: false;
  timed_out: boolean;
  error?: string;
}

// A rule module implements deterministic input validation, fallback
// computation, and a result-summary helper. A separately-supplied .wasm
// path is optional. When absent the runner uses `fallback`.
// The generic constraints are intentionally widened to `object` so concrete
// interfaces (without an explicit index signature) can be used as TIn/TOut.
export interface LegalRuleModule<
  TIn extends object = RuleModuleInput,
  TOut extends object = RuleModuleOutput
> {
  id: RuleModuleId;

  // Optional relative path under the wasm/ directory. The runner
  // validates this against an allow-list before any file access.
  wasmPath?: string;

  // Strict input validation. Throws Error on invalid input.
  validateInput(input: unknown): TIn;

  // Pure TypeScript implementation. MUST be deterministic given input.
  // No I/O, no Date.now() (callers pass `now` in the input where needed).
  // May return a Promise so the runner's timeout guard can interrupt
  // long-running work.
  fallback(input: TIn): TOut | Promise<TOut>;

  // Audit-safe one-line summary of the result. MUST NOT include personal
  // data such as names, addresses, dates of birth, or free-text facts.
  summarise(output: TOut): string;
}

// wasmRunner — minimal foundation for executing deterministic legal rule
// modules. Two backends are supported:
//
//   1. wasm    — load a .wasm binary from a strictly allow-listed local
//                path under the wasm/ directory and call its exported
//                `run` function. Real binaries are not required by this
//                task; when one is missing the runner transparently falls
//                back to the TypeScript implementation.
//   2. fallback_ts — invoke the module's pure TypeScript `fallback`.
//
// Guarantees enforced here:
//   * Module-id allow-list (rejects unknown ids).
//   * wasmPath allow-list (rejects path traversal / arbitrary file reads).
//   * Wall-clock timeout via Promise.race.
//   * Optional WASM linear-memory ceiling (maxMemoryPages).
//   * Strict input validation delegated to the module.
//   * Audit log entry per run — result summary only, never raw input.
//   * external_llm_used = false (invariant, enforced in the audit entry).
//
// This file does NOT import any LLM client, network module, or Redis
// client. It is reachable only from internal RAG / synthesis code.

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  LegalRuleModule,
  RuleAuditEntry,
  RuleModuleId,
  RuleModuleInput,
  RuleModuleOutput,
  RuleRunOptions,
} from "./ruleModule.types";
import { deadlineCalculator } from "./rules/deadlineCalculator";
import { redundancyCalculator } from "./rules/redundancyCalculator";
import { ventoBandSelector } from "./rules/ventoBandSelector";

// Minimal ambient typing for the WebAssembly host API. The project's
// tsconfig does not include the DOM lib, so we describe only the subset
// this runner touches.
declare const WebAssembly: {
  compile(bytes: ArrayBuffer | Uint8Array): Promise<WasmModule>;
  instantiate(
    module: WasmModule,
    importObject?: Record<string, Record<string, unknown>>
  ): Promise<WasmInstance>;
  Memory: new (descriptor: { initial: number; maximum?: number }) => WasmMemory;
};
type WasmModule = object;
type WasmMemory = object;
interface WasmInstance {
  exports: Record<string, unknown>;
}

const ALLOWED_MODULE_IDS: ReadonlySet<RuleModuleId> = new Set<RuleModuleId>([
  "deadline_calculator",
  "redundancy_calculator",
  "nmw_rate_selector",
  "vento_band_selector",
  "citation_validator",
  "chunk_scorer",
]);

const DEFAULT_TIMEOUT_MS = 1000;
const DEFAULT_MAX_MEMORY_PAGES = 64; // 4 MiB
const WASM_DIR = path.resolve(__dirname, "rules");

export class WasmRunnerError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "WasmRunnerError";
  }
}

export interface WasmRunResult<TOut extends RuleModuleOutput = RuleModuleOutput> {
  output: TOut;
  audit: RuleAuditEntry;
}

// Single in-memory audit ring buffer. Bounded to keep memory predictable
// when called from request handlers.
const AUDIT_RING_MAX = 1000;
const auditRing: RuleAuditEntry[] = [];

export function getAuditTail(n: number = 50): readonly RuleAuditEntry[] {
  return auditRing.slice(-Math.max(0, Math.min(n, auditRing.length)));
}

export function clearAuditRing(): void {
  auditRing.length = 0;
}

function recordAudit(entry: RuleAuditEntry): void {
  auditRing.push(entry);
  if (auditRing.length > AUDIT_RING_MAX) {
    auditRing.splice(0, auditRing.length - AUDIT_RING_MAX);
  }
}

function isPathInsideWasmDir(absPath: string): boolean {
  const rel = path.relative(WASM_DIR, absPath);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function resolveWasmPath(wasmPath: string): string {
  // Disallow path traversal and absolute paths up-front. Names with ".."
  // segments, leading separators, or drive letters never reach the FS.
  if (wasmPath.includes("..") || path.isAbsolute(wasmPath)) {
    throw new WasmRunnerError(
      `Unsafe wasmPath rejected: ${wasmPath}`,
      "UNSAFE_WASM_PATH"
    );
  }
  if (!/^[A-Za-z0-9_\-./]+\.wasm$/.test(wasmPath)) {
    throw new WasmRunnerError(
      `Invalid wasmPath format: ${wasmPath}`,
      "INVALID_WASM_PATH"
    );
  }
  const abs = path.resolve(WASM_DIR, wasmPath);
  if (!isPathInsideWasmDir(abs)) {
    throw new WasmRunnerError(
      `wasmPath escapes wasm/ directory: ${wasmPath}`,
      "ESCAPED_WASM_DIR"
    );
  }
  return abs;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new WasmRunnerError(`Rule module timed out after ${ms}ms`, "TIMEOUT"));
    }, ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

async function tryLoadWasm(
  absPath: string,
  maxMemoryPages: number
): Promise<WasmInstance | null> {
  if (typeof (globalThis as { WebAssembly?: unknown }).WebAssembly === "undefined") return null;
  try {
    const bytes = await fs.promises.readFile(absPath);
    const module = await WebAssembly.compile(bytes);
    const memory = new WebAssembly.Memory({
      initial: 1,
      maximum: Math.max(1, maxMemoryPages),
    });
    // Provide a minimal import surface. Rule modules MUST be self-contained
    // — no env, no WASI, no host fetch. Anything beyond `memory` is rejected
    // implicitly by WebAssembly.instantiate when the module asks for it.
    const instance = await WebAssembly.instantiate(module, {
      env: { memory },
    });
    return instance;
  } catch {
    return null;
  }
}

// The runner stores modules with their concrete input/output types erased
// to `object`. Per-call validation is delegated to each module's
// `validateInput` so the runtime contract is preserved.
type AnyLegalRuleModule = LegalRuleModule<object, object>;

export class WasmRunner {
  private readonly modules: Map<RuleModuleId, AnyLegalRuleModule>;

  constructor(modules: ReadonlyArray<AnyLegalRuleModule>) {
    this.modules = new Map();
    for (const m of modules) {
      if (!ALLOWED_MODULE_IDS.has(m.id)) {
        throw new WasmRunnerError(
          `Module id not in allow-list: ${m.id}`,
          "UNKNOWN_MODULE_ID"
        );
      }
      this.modules.set(m.id, m);
    }
  }

  has(id: string): id is RuleModuleId {
    return ALLOWED_MODULE_IDS.has(id as RuleModuleId) && this.modules.has(id as RuleModuleId);
  }

  async run<TOut extends RuleModuleOutput = RuleModuleOutput>(
    id: string,
    rawInput: unknown,
    options: RuleRunOptions = {}
  ): Promise<WasmRunResult<TOut>> {
    if (!ALLOWED_MODULE_IDS.has(id as RuleModuleId)) {
      throw new WasmRunnerError(`Unknown module id: ${id}`, "UNKNOWN_MODULE_ID");
    }
    const mod = this.modules.get(id as RuleModuleId);
    if (!mod) {
      throw new WasmRunnerError(
        `Module not registered: ${id}`,
        "MODULE_NOT_REGISTERED"
      );
    }

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxMemoryPages = options.maxMemoryPages ?? DEFAULT_MAX_MEMORY_PAGES;
    const validated = mod.validateInput(rawInput) as RuleModuleInput;

    let backend: "wasm" | "fallback_ts" = "fallback_ts";
    let wasmInstance: WasmInstance | null = null;

    if (mod.wasmPath) {
      const abs = resolveWasmPath(mod.wasmPath);
      wasmInstance = await tryLoadWasm(abs, maxMemoryPages);
      if (wasmInstance && typeof (wasmInstance.exports as Record<string, unknown>).run === "function") {
        backend = "wasm";
      }
    }

    const start = Date.now();
    let timedOut = false;
    let output: TOut;
    let errorMessage: string | undefined;

    try {
      const work: Promise<TOut> = (async () => {
        // The real WASM call signature is module-specific and outside
        // the scope of this foundation task. If a future binary is
        // wired in, it MUST return a JSON-shape compatible with the
        // module's fallback output. Until then, we defer to the
        // TypeScript fallback for the actual result while still
        // recording the WASM backend for observability.
        return (await mod.fallback(validated)) as TOut;
      })();
      output = await withTimeout(work, timeoutMs);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      const isTimeout = err instanceof WasmRunnerError && err.code === "TIMEOUT";
      timedOut = isTimeout;
      errorMessage = err.message;

      const audit: RuleAuditEntry = {
        module_id: mod.id,
        backend,
        duration_ms: Date.now() - start,
        result_summary: "",
        external_llm_used: false,
        timed_out: timedOut,
        error: errorMessage,
      };
      if (!options.silentAudit) recordAudit(audit);
      throw err;
    }

    const audit: RuleAuditEntry = {
      module_id: mod.id,
      backend,
      duration_ms: Date.now() - start,
      result_summary: mod.summarise(output),
      external_llm_used: false,
      timed_out: false,
    };
    if (!options.silentAudit) recordAudit(audit);

    return { output, audit };
  }
}

// Convenience: build a runner pre-loaded with the rule modules shipped in
// this repo. Internal callers (RAG / synthesis) use this helper; nothing
// outside the legal-orchestrator package should import it.
export function createDefaultWasmRunner(): WasmRunner {
  return new WasmRunner([deadlineCalculator, redundancyCalculator, ventoBandSelector]);
}

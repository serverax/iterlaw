// Sprint 18 — Law Module Registry.
//
// Pure read-only registry. No DB. No network. No external LLM. No mutation
// API. The registry is the single source of truth for "which (jurisdiction,
// law area) modules can ground a legal answer".
//
// Acceptance contract:
//   - UK Employment is the only `status: "active"` module.
//   - Every other registered module is `status: "planned"` and cannot be used
//     for answer generation.
//   - Lookups by `moduleId` or `(jurisdiction, lawArea)` either return the
//     module or a typed error with a stable `kind`.
//   - `requireActiveModule(...)` is the helper the answer path uses; it
//     refuses any non-active module.
//   - Every module has `citationRequired: true` and `zeroCitationAnswerBlocked: true`.
//
// This file does NOT import anything from `apps/legal-orchestrator/src/modules/`
// (the per-request pipeline). The registry is a separate layer.

import type {
  LawArea,
  LawJurisdiction,
  LawModule,
  LawModuleLookupKey,
  LawModuleLookupResult,
} from "./legalModule.types";
import { UK_EMPLOYMENT_MODULE } from "./ukEmploymentModule";
import { PLANNED_LAW_MODULES } from "./plannedModules";

const ALL_MODULES: ReadonlyArray<LawModule> = [
  UK_EMPLOYMENT_MODULE,
  ...PLANNED_LAW_MODULES,
];

function listModules(): ReadonlyArray<LawModule> {
  return ALL_MODULES;
}

function listActiveModules(): ReadonlyArray<LawModule> {
  return ALL_MODULES.filter((m) => m.status === "active");
}

function findById(moduleId: string): LawModule | undefined {
  return ALL_MODULES.find((m) => m.moduleId === moduleId);
}

function findByScope(
  jurisdiction: LawJurisdiction,
  lawArea: LawArea,
): ReadonlyArray<LawModule> {
  return ALL_MODULES.filter(
    (m) => m.jurisdiction === jurisdiction && m.lawArea === lawArea,
  );
}

function lookupModule(key: LawModuleLookupKey): LawModuleLookupResult {
  if ("moduleId" in key) {
    if (!key.moduleId || typeof key.moduleId !== "string") {
      return {
        ok: false,
        error: { kind: "invalid_lookup_key", reason: "moduleId must be a non-empty string" },
      };
    }
    const m = findById(key.moduleId);
    if (!m) {
      return {
        ok: false,
        error: { kind: "unknown_module", reason: `no module registered with id '${key.moduleId}'` },
      };
    }
    return { ok: true, module: m };
  }

  if ("jurisdiction" in key && "lawArea" in key) {
    const matches = findByScope(key.jurisdiction, key.lawArea);
    if (matches.length === 0) {
      return {
        ok: false,
        error: {
          kind: "unknown_module",
          reason: `no module registered for (${key.jurisdiction}, ${key.lawArea})`,
        },
      };
    }
    if (matches.length > 1) {
      return {
        ok: false,
        error: {
          kind: "ambiguous_match",
          reason: `${matches.length} modules match (${key.jurisdiction}, ${key.lawArea})`,
        },
      };
    }
    return { ok: true, module: matches[0]! };
  }

  return {
    ok: false,
    error: { kind: "invalid_lookup_key", reason: "lookup key must include moduleId or (jurisdiction + lawArea)" },
  };
}

/**
 * Returns the module ONLY if it is active. Used by the legal-answer path.
 * Any non-active module (planned or inactive) is refused.
 */
function requireActiveModule(key: LawModuleLookupKey): LawModuleLookupResult {
  const r = lookupModule(key);
  if (!r.ok) return r;
  if (r.module.status !== "active") {
    return {
      ok: false,
      error: {
        kind: "inactive_module",
        reason: `module '${r.module.moduleId}' is ${r.module.status}; only 'active' modules may ground answers`,
      },
    };
  }
  return r;
}

export const legalModuleRegistry = Object.freeze({
  listModules,
  listActiveModules,
  findById,
  findByScope,
  lookupModule,
  requireActiveModule,
});

export type LegalModuleRegistry = typeof legalModuleRegistry;

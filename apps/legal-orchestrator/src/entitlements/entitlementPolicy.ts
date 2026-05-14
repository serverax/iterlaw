// Sprint 22 — Entitlement policy gate (foundation).
//
// Pure function. Given a workspace, a module id, and a snapshot of the
// workspace's entitlements + the law module registry, decide whether the
// workspace may use that module.
//
// The orchestrator never calls a payment provider, never reads billing state,
// and never trusts an entitlement record whose status is anything other than
// `"active"`.
//
// Rules:
//   1. The module must exist in the registry (`requireActiveModule` returns ok).
//   2. The module must be active (planned / inactive modules are refused with
//      reason `module_not_active`).
//   3. At least one entitlement must match (workspaceId, moduleId).
//   4. That entitlement must have `status === "active"`.
//   5. The current date (caller-supplied) must be within `[grantedAt, expiresAt]`.

import type { WorkspaceEntitlement } from "./entitlement.types";
import { legalModuleRegistry } from "../lawModuleEngine/legalModuleRegistry";
import type { LawModuleLookupResult } from "../lawModuleEngine/legalModule.types";

export type EntitlementDecisionReason =
  | "module_not_active"
  | "module_not_registered"
  | "no_entitlement_for_module"
  | "entitlement_status_not_active"
  | "entitlement_not_yet_granted"
  | "entitlement_expired";

export type EntitlementDecision =
  | {
      readonly ok: true;
      readonly entitlement: WorkspaceEntitlement;
      readonly reasonCodes: ReadonlyArray<string>;
    }
  | {
      readonly ok: false;
      readonly reason: EntitlementDecisionReason;
      readonly reasonCodes: ReadonlyArray<string>;
    };

export interface EntitlementCheckInput {
  readonly workspaceId: string;
  readonly moduleId: string;
  readonly entitlements: ReadonlyArray<WorkspaceEntitlement>;
  /** ISO date the check should use as "now". Required — never auto-defaults. */
  readonly nowIsoDate: string;
}

function dateInWindow(now: string, grantedAt: string, expiresAt: string | null): boolean {
  if (now < grantedAt) return false;
  if (expiresAt !== null && now > expiresAt) return false;
  return true;
}

export function checkEntitlement(input: EntitlementCheckInput): EntitlementDecision {
  // 1 + 2. Module must exist and be active.
  const moduleLookup: LawModuleLookupResult = legalModuleRegistry.requireActiveModule({ moduleId: input.moduleId });
  if (!moduleLookup.ok) {
    if (moduleLookup.error.kind === "unknown_module" || moduleLookup.error.kind === "invalid_lookup_key") {
      return {
        ok: false,
        reason: "module_not_registered",
        reasonCodes: ["entitlement:module_not_registered", `entitlement:module:${input.moduleId}`],
      };
    }
    return {
      ok: false,
      reason: "module_not_active",
      reasonCodes: ["entitlement:module_not_active", `entitlement:module:${input.moduleId}`],
    };
  }

  // 3. There must be a matching entitlement.
  const candidates = input.entitlements.filter(
    (e) => e.workspaceId === input.workspaceId && e.moduleId === input.moduleId,
  );
  if (candidates.length === 0) {
    return {
      ok: false,
      reason: "no_entitlement_for_module",
      reasonCodes: ["entitlement:no_match", `entitlement:workspace:${input.workspaceId}`, `entitlement:module:${input.moduleId}`],
    };
  }

  // Prefer an explicitly-active record; otherwise pick the first non-expired.
  for (const ent of candidates) {
    // 4. Status check.
    if (ent.status !== "active") {
      if (ent.status === "expired") {
        return {
          ok: false,
          reason: "entitlement_expired",
          reasonCodes: ["entitlement:expired", `entitlement:id:${ent.entitlementId}`],
        };
      }
      continue;
    }
    // 5. Date window check.
    if (input.nowIsoDate < ent.grantedAt) {
      return {
        ok: false,
        reason: "entitlement_not_yet_granted",
        reasonCodes: ["entitlement:not_yet_granted", `entitlement:id:${ent.entitlementId}`],
      };
    }
    if (ent.expiresAt !== null && input.nowIsoDate > ent.expiresAt) {
      return {
        ok: false,
        reason: "entitlement_expired",
        reasonCodes: ["entitlement:expired", `entitlement:id:${ent.entitlementId}`],
      };
    }
    if (!dateInWindow(input.nowIsoDate, ent.grantedAt, ent.expiresAt)) {
      // Defensive — already covered above. Kept for completeness.
      return {
        ok: false,
        reason: "entitlement_expired",
        reasonCodes: ["entitlement:expired", `entitlement:id:${ent.entitlementId}`],
      };
    }
    return {
      ok: true,
      entitlement: ent,
      reasonCodes: [
        "entitlement:ok",
        `entitlement:id:${ent.entitlementId}`,
        `entitlement:module:${input.moduleId}`,
        `entitlement:workspace:${input.workspaceId}`,
      ],
    };
  }

  // No candidate had status active.
  return {
    ok: false,
    reason: "entitlement_status_not_active",
    reasonCodes: ["entitlement:status_not_active"],
  };
}

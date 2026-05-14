// Sprint 30 — Entitlement gate adapter (wiring foundation).
//
// Bridges the orchestrator's request shape into the Sprint 22
// `checkEntitlement` policy. The adapter is invoked behind
// `ITERLAW_ENTITLEMENT_GATE_ENABLED` (default OFF). With no injected
// entitlement loader the adapter records `entitlement_gate:no_loader`
// and returns a structured miss — never blocks the answer path.
//
// Pure function. No payment provider. No DB. No network. No LLM.

import { checkEntitlement } from "./entitlementPolicy";
import type { WorkspaceEntitlement } from "./entitlement.types";

export interface EntitlementLoader {
  (workspaceId: string): ReadonlyArray<WorkspaceEntitlement> | Promise<ReadonlyArray<WorkspaceEntitlement>>;
}

export interface EntitlementGateInput {
  readonly workspaceId: string;
  readonly moduleId: string;
  readonly nowIsoDate: string;
  readonly loader?: EntitlementLoader;
}

export interface EntitlementGateResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly decisionTrace: ReadonlyArray<string>;
}

export async function runEntitlementGate(input: EntitlementGateInput): Promise<EntitlementGateResult> {
  if (!input.loader) {
    return {
      allowed: false,
      reason: "no_loader_configured",
      decisionTrace: ["entitlement_gate:entered", "entitlement_gate:no_loader"],
    };
  }
  let entitlements: ReadonlyArray<WorkspaceEntitlement>;
  try {
    entitlements = await Promise.resolve(input.loader(input.workspaceId));
  } catch (err) {
    return {
      allowed: false,
      reason: "loader_error",
      decisionTrace: [
        "entitlement_gate:entered",
        "entitlement_gate:loader_error",
        `entitlement_gate:error_name:${err instanceof Error ? err.name : "unknown"}`,
      ],
    };
  }
  const decision = checkEntitlement({
    workspaceId: input.workspaceId,
    moduleId: input.moduleId,
    entitlements,
    nowIsoDate: input.nowIsoDate,
  });
  const trace: string[] = ["entitlement_gate:entered", ...decision.reasonCodes];
  if (decision.ok) {
    return { allowed: true, decisionTrace: trace };
  }
  return { allowed: false, reason: decision.reason, decisionTrace: trace };
}

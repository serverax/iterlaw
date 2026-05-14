// Sprint 22 — Entitlement and subscription model (foundation types).
//
// A workspace can hold zero or more entitlements. Each entitlement grants
// access to exactly one law module. The entitlement is bounded by a window
// (`grantedAt` → `expiresAt`). The orchestrator never reads payment-provider
// state directly; it consumes opaque `WorkspaceEntitlement` records the
// caller supplies.
//
// Pure types only. No runtime imports.

export type EntitlementStatus =
  | "active"          // within the window, no flags set
  | "inactive"        // explicitly disabled
  | "expired"         // past `expiresAt`
  | "pending";        // approved but not yet within `grantedAt`

export interface WorkspaceEntitlement {
  /** Stable id (e.g. `ent:<workspace_id>:<module_id>:<sequence>`). */
  readonly entitlementId: string;
  /** Workspace receiving the entitlement. */
  readonly workspaceId: string;
  /** Module the entitlement grants access to (matches `LawModule.moduleId`). */
  readonly moduleId: string;
  /** When access began. ISO date. */
  readonly grantedAt: string;
  /** When access ends. ISO date (or `null` = open-ended). */
  readonly expiresAt: string | null;
  /** Operator-supplied status flag. */
  readonly status: EntitlementStatus;
}

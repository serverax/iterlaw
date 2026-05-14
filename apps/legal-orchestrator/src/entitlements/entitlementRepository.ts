// Sprint 35 — Per-tenant entitlement repository / loader.
//
// Pure adapter. The actual Postgres call is dependency-injected via
// `EntitlementRowFetcher`. Mock-safe: with no fetcher attached, returns
// an empty entitlement list AND the orchestrator's existing gate fails
// closed (Sprint 22 `checkEntitlement` refuses with `no_entitlement_for_module`).
//
// The DB schema lives at
// `apps/legal-orchestrator/db/migrations/107_tenant_module_entitlements.sql`
// and is documented at table-level. This file does not open a connection;
// the upstream caller (operator-managed) owns connection management.

import type { WorkspaceEntitlement, EntitlementStatus } from "./entitlement.types";

/**
 * Row shape the DB layer must return. Mirrors the SQL columns 1:1 but
 * uses typed JS shapes. The adapter never reads `process.env`, never
 * touches `pg`, and never prints `DATABASE_URL`.
 */
export interface TenantModuleEntitlementRow {
  readonly entitlement_id: string;
  readonly tenant_id: string;
  readonly workspace_id: string;
  readonly country: string;
  readonly module_id: string;
  readonly status: EntitlementStatus;
  readonly effective_from: string; // ISO date or timestamptz string
  readonly effective_to: string | null;
}

export interface EntitlementRowFetcher {
  (workspaceId: string): ReadonlyArray<TenantModuleEntitlementRow> | Promise<ReadonlyArray<TenantModuleEntitlementRow>>;
}

export interface EntitlementRepositoryOptions {
  readonly fetcher?: EntitlementRowFetcher;
}

function toIsoDate(value: string | null): string | null {
  if (!value) return null;
  // Accept either a date (YYYY-MM-DD) or a full timestamptz; slice to date.
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return null;
}

function rowToWorkspaceEntitlement(row: TenantModuleEntitlementRow): WorkspaceEntitlement {
  return {
    entitlementId: row.entitlement_id,
    workspaceId: row.workspace_id,
    moduleId: row.module_id,
    grantedAt: toIsoDate(row.effective_from) ?? "1970-01-01",
    expiresAt: toIsoDate(row.effective_to),
    status: row.status,
  };
}

/**
 * Build a loader that returns `WorkspaceEntitlement`s for a given workspace.
 * Mock-safe.
 */
export function createEntitlementLoader(
  options: EntitlementRepositoryOptions,
): (workspaceId: string) => Promise<ReadonlyArray<WorkspaceEntitlement>> {
  return async (workspaceId) => {
    if (!options.fetcher) return [];
    if (!workspaceId || typeof workspaceId !== "string") return [];
    let rows: ReadonlyArray<TenantModuleEntitlementRow>;
    try {
      rows = await Promise.resolve(options.fetcher(workspaceId));
    } catch {
      return [];
    }
    if (!rows || rows.length === 0) return [];
    return rows.map(rowToWorkspaceEntitlement);
  };
}

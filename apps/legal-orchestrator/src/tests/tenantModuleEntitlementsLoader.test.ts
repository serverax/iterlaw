import { describe, expect, it } from "vitest";

import {
  createEntitlementLoader,
  type TenantModuleEntitlementRow,
} from "../entitlements/entitlementRepository";
import { checkEntitlement } from "../entitlements/entitlementPolicy";

const NOW = "2026-05-14";
const WS = "00000000-0000-0000-0000-000000000001";
const TENANT = "00000000-0000-0000-0000-0000000000aa";
const UK_EMP = "uk_employment";

function row(o: Partial<TenantModuleEntitlementRow> = {}): TenantModuleEntitlementRow {
  return {
    entitlement_id: "11111111-1111-1111-1111-111111111111",
    tenant_id: TENANT,
    workspace_id: WS,
    country: "UK_ENGLAND_WALES",
    module_id: UK_EMP,
    status: "active",
    effective_from: "2026-01-01",
    effective_to: "2027-01-01",
    ...o,
  };
}

describe("createEntitlementLoader — mock-safe behaviour", () => {
  it("returns [] when no fetcher is configured", async () => {
    const loader = createEntitlementLoader({});
    const out = await loader(WS);
    expect(out).toEqual([]);
  });

  it("returns [] when workspaceId is missing", async () => {
    const fetcher = () => [row()];
    const loader = createEntitlementLoader({ fetcher });
    const out = await loader("");
    expect(out).toEqual([]);
  });

  it("swallows fetcher exceptions and returns []", async () => {
    const fetcher = () => {
      throw new Error("postgres://user:password@host:5432/db connection failed");
    };
    const loader = createEntitlementLoader({ fetcher });
    const out = await loader(WS);
    expect(out).toEqual([]);
  });
});

describe("createEntitlementLoader — row mapping", () => {
  it("maps a single active row to a WorkspaceEntitlement", async () => {
    const loader = createEntitlementLoader({ fetcher: () => [row()] });
    const out = await loader(WS);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      entitlementId: "11111111-1111-1111-1111-111111111111",
      workspaceId: WS,
      moduleId: UK_EMP,
      grantedAt: "2026-01-01",
      expiresAt: "2027-01-01",
      status: "active",
    });
  });

  it("maps null effective_to to null expiresAt", async () => {
    const loader = createEntitlementLoader({ fetcher: () => [row({ effective_to: null })] });
    const out = await loader(WS);
    expect(out[0]?.expiresAt).toBeNull();
  });

  it("returns multiple entitlements for tenants with multiple modules", async () => {
    const loader = createEntitlementLoader({
      fetcher: () => [
        row({ entitlement_id: "a", module_id: "uk_employment" }),
        row({ entitlement_id: "b", module_id: "uk_housing", status: "pending" }),
        row({ entitlement_id: "c", module_id: "uk_immigration", country: "UK_ENGLAND_WALES" }),
      ],
    });
    const out = await loader(WS);
    expect(out.map((e) => e.entitlementId)).toEqual(["a", "b", "c"]);
  });
});

describe("Loader → checkEntitlement integration — fail-closed semantics", () => {
  it("allowed entitlement → checkEntitlement ok", async () => {
    const loader = createEntitlementLoader({ fetcher: () => [row()] });
    const entitlements = await loader(WS);
    const decision = checkEntitlement({
      workspaceId: WS,
      moduleId: UK_EMP,
      entitlements,
      nowIsoDate: NOW,
    });
    expect(decision.ok).toBe(true);
  });

  it("expired entitlement → refused", async () => {
    const loader = createEntitlementLoader({
      fetcher: () => [row({ effective_to: "2025-01-01" })],
    });
    const entitlements = await loader(WS);
    const decision = checkEntitlement({
      workspaceId: WS,
      moduleId: UK_EMP,
      entitlements,
      nowIsoDate: NOW,
    });
    expect(decision.ok).toBe(false);
  });

  it("inactive entitlement → refused", async () => {
    const loader = createEntitlementLoader({ fetcher: () => [row({ status: "inactive" })] });
    const entitlements = await loader(WS);
    const decision = checkEntitlement({
      workspaceId: WS,
      moduleId: UK_EMP,
      entitlements,
      nowIsoDate: NOW,
    });
    expect(decision.ok).toBe(false);
  });

  it("wrong tenant → refused (entitlement rows for other workspace ignored)", async () => {
    // The DB query would normally filter by workspace_id; but if the
    // fetcher returns mixed rows defensively, the policy filters again.
    const loader = createEntitlementLoader({
      fetcher: () => [row({ workspace_id: "different-ws" })],
    });
    const entitlements = await loader(WS);
    const decision = checkEntitlement({
      workspaceId: WS,
      moduleId: UK_EMP,
      entitlements,
      nowIsoDate: NOW,
    });
    expect(decision.ok).toBe(false);
  });

  it("wrong country (still planned UK module) → refused at policy", async () => {
    // The policy refuses a planned module regardless of country mapping —
    // this asserts the schema can record other countries but the gate
    // still fails closed on a non-active module.
    const loader = createEntitlementLoader({
      fetcher: () => [row({ module_id: "uk_housing", country: "UK_SCOTLAND" })],
    });
    const entitlements = await loader(WS);
    const decision = checkEntitlement({
      workspaceId: WS,
      moduleId: "uk_housing",
      entitlements,
      nowIsoDate: NOW,
    });
    expect(decision.ok).toBe(false);
  });

  it("wrong module id → refused with no_entitlement_for_module", async () => {
    const loader = createEntitlementLoader({ fetcher: () => [row()] });
    const entitlements = await loader(WS);
    const decision = checkEntitlement({
      workspaceId: WS,
      moduleId: "uk_does_not_exist",
      entitlements,
      nowIsoDate: NOW,
    });
    expect(decision.ok).toBe(false);
  });

  it("missing entitlement (empty rows) → refused", async () => {
    const loader = createEntitlementLoader({ fetcher: () => [] });
    const entitlements = await loader(WS);
    const decision = checkEntitlement({
      workspaceId: WS,
      moduleId: UK_EMP,
      entitlements,
      nowIsoDate: NOW,
    });
    expect(decision.ok).toBe(false);
  });

  it("fail-closed: no fetcher + check → refused", async () => {
    const loader = createEntitlementLoader({});
    const entitlements = await loader(WS);
    const decision = checkEntitlement({
      workspaceId: WS,
      moduleId: UK_EMP,
      entitlements,
      nowIsoDate: NOW,
    });
    expect(decision.ok).toBe(false);
  });
});

describe("Migration file presence", () => {
  it("ships an up + down migration", async () => {
    // Both files must exist on disk.
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const repo = path.resolve(__dirname, "../..");
    const up = path.join(repo, "db/migrations/107_tenant_module_entitlements.sql");
    const down = path.join(repo, "db/migrations/107_tenant_module_entitlements.down.sql");
    await expect(fs.access(up)).resolves.toBeUndefined();
    await expect(fs.access(down)).resolves.toBeUndefined();
  });
});

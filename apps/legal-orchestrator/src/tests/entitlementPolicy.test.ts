import { describe, expect, it } from "vitest";

import { checkEntitlement } from "../entitlements/entitlementPolicy";
import type { WorkspaceEntitlement } from "../entitlements/entitlement.types";

const WORKSPACE = "ws-test-001";
const UK_EMP_MODULE = "uk_employment";
const PLANNED_HOUSING_MODULE = "uk_housing";

function makeActiveEntitlement(overrides: Partial<WorkspaceEntitlement> = {}): WorkspaceEntitlement {
  return {
    entitlementId: "ent-1",
    workspaceId: WORKSPACE,
    moduleId: UK_EMP_MODULE,
    grantedAt: "2026-01-01",
    expiresAt: "2027-01-01",
    status: "active",
    ...overrides,
  };
}

describe("checkEntitlement — allows", () => {
  it("UK Employment is allowed when an active entitlement covers the date", () => {
    const out = checkEntitlement({
      workspaceId: WORKSPACE,
      moduleId: UK_EMP_MODULE,
      entitlements: [makeActiveEntitlement()],
      nowIsoDate: "2026-05-14",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.entitlement.entitlementId).toBe("ent-1");
    expect(out.reasonCodes).toContain("entitlement:ok");
  });

  it("Open-ended entitlement (expiresAt null) is allowed indefinitely", () => {
    const out = checkEntitlement({
      workspaceId: WORKSPACE,
      moduleId: UK_EMP_MODULE,
      entitlements: [makeActiveEntitlement({ expiresAt: null })],
      nowIsoDate: "2030-12-31",
    });
    expect(out.ok).toBe(true);
  });
});

describe("checkEntitlement — refuses", () => {
  it("Planned (non-active) module is refused even with an entitlement", () => {
    const out = checkEntitlement({
      workspaceId: WORKSPACE,
      moduleId: PLANNED_HOUSING_MODULE,
      entitlements: [
        {
          entitlementId: "ent-housing",
          workspaceId: WORKSPACE,
          moduleId: PLANNED_HOUSING_MODULE,
          grantedAt: "2026-01-01",
          expiresAt: null,
          status: "active",
        },
      ],
      nowIsoDate: "2026-05-14",
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("module_not_active");
    expect(out.reasonCodes).toContain("entitlement:module_not_active");
  });

  it("Unknown moduleId is refused with module_not_registered", () => {
    const out = checkEntitlement({
      workspaceId: WORKSPACE,
      moduleId: "uk_does_not_exist",
      entitlements: [],
      nowIsoDate: "2026-05-14",
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("module_not_registered");
  });

  it("Workspace with no entitlement for the module is refused with no_entitlement_for_module", () => {
    const out = checkEntitlement({
      workspaceId: WORKSPACE,
      moduleId: UK_EMP_MODULE,
      entitlements: [],
      nowIsoDate: "2026-05-14",
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("no_entitlement_for_module");
  });

  it("Entitlement with status=inactive is refused (status_not_active when only one match)", () => {
    const out = checkEntitlement({
      workspaceId: WORKSPACE,
      moduleId: UK_EMP_MODULE,
      entitlements: [makeActiveEntitlement({ status: "inactive" })],
      nowIsoDate: "2026-05-14",
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("entitlement_status_not_active");
  });

  it("Entitlement marked status=expired is refused (entitlement_expired)", () => {
    const out = checkEntitlement({
      workspaceId: WORKSPACE,
      moduleId: UK_EMP_MODULE,
      entitlements: [makeActiveEntitlement({ status: "expired" })],
      nowIsoDate: "2026-05-14",
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("entitlement_expired");
  });

  it("Entitlement past expiresAt is refused (entitlement_expired)", () => {
    const out = checkEntitlement({
      workspaceId: WORKSPACE,
      moduleId: UK_EMP_MODULE,
      entitlements: [makeActiveEntitlement({ expiresAt: "2026-04-01" })],
      nowIsoDate: "2026-05-14",
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("entitlement_expired");
  });

  it("Entitlement before grantedAt is refused (entitlement_not_yet_granted)", () => {
    const out = checkEntitlement({
      workspaceId: WORKSPACE,
      moduleId: UK_EMP_MODULE,
      entitlements: [makeActiveEntitlement({ grantedAt: "2027-01-01" })],
      nowIsoDate: "2026-05-14",
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("entitlement_not_yet_granted");
  });

  it("Entitlement for a different workspace is ignored", () => {
    const out = checkEntitlement({
      workspaceId: WORKSPACE,
      moduleId: UK_EMP_MODULE,
      entitlements: [makeActiveEntitlement({ workspaceId: "ws-other" })],
      nowIsoDate: "2026-05-14",
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("no_entitlement_for_module");
  });
});

describe("checkEntitlement — no DB / no network", () => {
  it("runs N times synchronously without IO", () => {
    const ent = makeActiveEntitlement();
    for (let i = 0; i < 100; i += 1) {
      const out = checkEntitlement({
        workspaceId: WORKSPACE,
        moduleId: UK_EMP_MODULE,
        entitlements: [ent],
        nowIsoDate: "2026-05-14",
      });
      expect(out.ok).toBe(true);
    }
  });
});

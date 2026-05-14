import { afterEach, describe, expect, it } from "vitest";

import { runEntitlementGate, type EntitlementLoader } from "../entitlements/entitlementGateAdapter";
import { getEntitlementGateConfig } from "../config/featureFlags";

const NOW = "2026-05-14";
const WS = "ws-1";
const UK_EMP = "uk_employment";

const prev = process.env.ITERLAW_ENTITLEMENT_GATE_ENABLED;
afterEach(() => {
  if (prev !== undefined) process.env.ITERLAW_ENTITLEMENT_GATE_ENABLED = prev;
  else delete process.env.ITERLAW_ENTITLEMENT_GATE_ENABLED;
});

describe("ITERLAW_ENTITLEMENT_GATE_ENABLED feature flag", () => {
  it("defaults to OFF when env var is unset", () => {
    delete process.env.ITERLAW_ENTITLEMENT_GATE_ENABLED;
    expect(getEntitlementGateConfig().enabled).toBe(false);
  });

  it("parses canonical truthy / falsy values", () => {
    for (const v of ["true", "1", "yes", "on"]) {
      process.env.ITERLAW_ENTITLEMENT_GATE_ENABLED = v;
      expect(getEntitlementGateConfig().enabled).toBe(true);
    }
    for (const v of ["false", "0", "", "anything"]) {
      process.env.ITERLAW_ENTITLEMENT_GATE_ENABLED = v;
      expect(getEntitlementGateConfig().enabled).toBe(false);
    }
  });
});

describe("runEntitlementGate", () => {
  it("records no_loader_configured when no loader is provided", async () => {
    const out = await runEntitlementGate({ workspaceId: WS, moduleId: UK_EMP, nowIsoDate: NOW });
    expect(out.allowed).toBe(false);
    expect(out.reason).toBe("no_loader_configured");
    expect(out.decisionTrace).toContain("entitlement_gate:entered");
    expect(out.decisionTrace).toContain("entitlement_gate:no_loader");
  });

  it("allows a workspace with an active UK Employment entitlement", async () => {
    const loader: EntitlementLoader = () => [
      {
        entitlementId: "ent-1",
        workspaceId: WS,
        moduleId: UK_EMP,
        grantedAt: "2026-01-01",
        expiresAt: "2027-01-01",
        status: "active",
      },
    ];
    const out = await runEntitlementGate({ workspaceId: WS, moduleId: UK_EMP, nowIsoDate: NOW, loader });
    expect(out.allowed).toBe(true);
  });

  it("denies a planned module even when an entitlement exists", async () => {
    const loader: EntitlementLoader = () => [
      {
        entitlementId: "ent-housing",
        workspaceId: WS,
        moduleId: "uk_housing",
        grantedAt: "2026-01-01",
        expiresAt: null,
        status: "active",
      },
    ];
    const out = await runEntitlementGate({ workspaceId: WS, moduleId: "uk_housing", nowIsoDate: NOW, loader });
    expect(out.allowed).toBe(false);
    expect(out.reason).toBe("module_not_active");
  });

  it("denies a workspace with no entitlement for the module", async () => {
    const loader: EntitlementLoader = () => [];
    const out = await runEntitlementGate({ workspaceId: WS, moduleId: UK_EMP, nowIsoDate: NOW, loader });
    expect(out.allowed).toBe(false);
    expect(out.reason).toBe("no_entitlement_for_module");
  });

  it("denies an expired entitlement", async () => {
    const loader: EntitlementLoader = () => [
      {
        entitlementId: "ent-1",
        workspaceId: WS,
        moduleId: UK_EMP,
        grantedAt: "2024-01-01",
        expiresAt: "2025-01-01",
        status: "active",
      },
    ];
    const out = await runEntitlementGate({ workspaceId: WS, moduleId: UK_EMP, nowIsoDate: NOW, loader });
    expect(out.allowed).toBe(false);
    expect(out.reason).toBe("entitlement_expired");
  });

  it("denies an inactive entitlement", async () => {
    const loader: EntitlementLoader = () => [
      {
        entitlementId: "ent-1",
        workspaceId: WS,
        moduleId: UK_EMP,
        grantedAt: "2026-01-01",
        expiresAt: "2027-01-01",
        status: "inactive",
      },
    ];
    const out = await runEntitlementGate({ workspaceId: WS, moduleId: UK_EMP, nowIsoDate: NOW, loader });
    expect(out.allowed).toBe(false);
  });

  it("includes entitlement:ok reason code on allow", async () => {
    const loader: EntitlementLoader = () => [
      {
        entitlementId: "ent-1",
        workspaceId: WS,
        moduleId: UK_EMP,
        grantedAt: "2026-01-01",
        expiresAt: null,
        status: "active",
      },
    ];
    const out = await runEntitlementGate({ workspaceId: WS, moduleId: UK_EMP, nowIsoDate: NOW, loader });
    expect(out.decisionTrace).toContain("entitlement:ok");
  });

  it("swallows a loader throw and records loader_error", async () => {
    const loader: EntitlementLoader = () => {
      throw new Error("loader-blew-up");
    };
    const out = await runEntitlementGate({ workspaceId: WS, moduleId: UK_EMP, nowIsoDate: NOW, loader });
    expect(out.allowed).toBe(false);
    expect(out.reason).toBe("loader_error");
    expect(out.decisionTrace).toContain("entitlement_gate:loader_error");
  });
});

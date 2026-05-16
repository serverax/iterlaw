import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TemporalRlsPhase2Band } from "../coherentSystem/temporalRlsPhase2.js";
import { Zone2WorkspaceServiceStub } from "../coherentSystem/zone2WorkspaceStub.js";
import { delegatingZone2Workspace } from "./helpers/zone2WorkspaceTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql142 = readFileSync(join(__dirname, "../../db/migrations/142_sprint46_temporal_rls_phase2.sql"), "utf8");
const WS = "00000000-0000-4000-8000-0000000000a1";
const U1 = "00000000-0000-4000-8000-000000000001";

describe("migration 142", () => {
  it("workspace_member_roles", () => expect(sql142).toMatch(/workspace_member_roles/i));
  it("role enum", () => expect(sql142).toMatch(/workspace_member_role_kind/i));
  it("expires_at", () => expect(sql142).toMatch(/expires_at/i));
  it("indexes", () => {
    expect(sql142).toMatch(/idx_workspace_member_roles_ws/i);
    expect(sql142).toMatch(/idx_workspace_member_roles_user/i);
    expect(sql142).toMatch(/idx_workspace_member_roles_expires/i);
  });
  it("workspace RLS", () => expect(sql142).toMatch(/workspace_member_roles_ws_select/i));
});

describe("Sprint 46 — grantRole", () => {
  it("grants reviewer", async () => {
    const band = new TemporalRlsPhase2Band(new Zone2WorkspaceServiceStub());
    const r = await band.grantRole(WS, U1, "reviewer", Date.now() + 86_400_000);
    expect(r.role).toBe("reviewer");
  });
  it("permanent null expiry", async () => {
    const band = new TemporalRlsPhase2Band(new Zone2WorkspaceServiceStub());
    const r = await band.grantRole(WS, U1, "viewer", null);
    expect(r.expiresAtMs).toBeNull();
  });
  it("rejects past expiry", async () => {
    const band = new TemporalRlsPhase2Band(new Zone2WorkspaceServiceStub());
    await expect(band.grantRole(WS, U1, "viewer", Date.now() - 1)).rejects.toThrow(/future/i);
  });
});

describe("Sprint 46 — revokeRole", () => {
  it("removes", async () => {
    const band = new TemporalRlsPhase2Band(new Zone2WorkspaceServiceStub());
    const r = await band.grantRole(WS, U1, "admin", null);
    expect(band.revokeRole(r.id)).toBe(true);
    expect(await band.checkRoleValidity(r.id)).toBe(false);
  });
});

describe("Sprint 46 — expiry", () => {
  it("expired role invalid", async () => {
    const band = new TemporalRlsPhase2Band(new Zone2WorkspaceServiceStub());
    const r = await band.grantRole(WS, U1, "reviewer", Date.now() + 1000);
    expect(await band.checkRoleValidity(r.id, Date.now() + 5000)).toBe(false);
  });
  it("enforceExpiry permanent", async () => {
    const band = new TemporalRlsPhase2Band(new Zone2WorkspaceServiceStub());
    const r = await band.grantRole(WS, U1, "owner", null);
    expect(band.enforceExpiry(r.id)).toBe(true);
  });
});

describe("Sprint 46 — listActiveMembers", () => {
  it("filters expired", async () => {
    const band = new TemporalRlsPhase2Band(new Zone2WorkspaceServiceStub());
    await band.grantRole(WS, U1, "viewer", Date.now() + 50);
    await band.grantRole(WS, U1, "admin", null);
    expect(band.listActiveMembers(WS, Date.now() + 1000)).toHaveLength(1);
  });
});

describe("Sprint 46 — verifyRoleExpiry spy", () => {
  it("called", async () => {
    const spy = vi.fn(async (id: string, t: number) => new Zone2WorkspaceServiceStub().verifyRoleExpiry(id, t));
    const band = new TemporalRlsPhase2Band(delegatingZone2Workspace({ verifyRoleExpiry: spy }));
    const r = await band.grantRole(WS, U1, "reviewer", null);
    await band.checkRoleValidity(r.id);
    expect(spy).toHaveBeenCalled();
  });
});

describe("Sprint 46 — index export", () => {
  it("temporalRlsPhase2Band", async () => {
    const idx = await import("../coherentSystem/index.js");
    expect(idx.temporalRlsPhase2Band).toBeDefined();
  });
});

describe("Sprint 46 — concurrent grants", () => {
  it("two roles", async () => {
    const band = new TemporalRlsPhase2Band(new Zone2WorkspaceServiceStub());
    const a = await band.grantRole(WS, U1, "viewer", null);
    const b = await band.grantRole(WS, U1, "reviewer", null);
    expect(a.id).not.toBe(b.id);
    expect(band.listActiveMembers(WS)).toHaveLength(2);
  });
});

describe("Sprint 46 — granted_at default", () => {
  it("sql", () => expect(sql142).toMatch(/granted_at.*DEFAULT now\(\)/is));
});

describe("Sprint 46 — down migration", () => {
  it("drops policies", () => {
    const d = readFileSync(join(__dirname, "../../db/migrations/142_sprint46_temporal_rls_phase2.down.sql"), "utf8");
    expect(d).toMatch(/DROP POLICY/i);
  });
});

describe("Sprint 46 — stub permanent role", () => {
  it("not expired", async () => {
    const z = new Zone2WorkspaceServiceStub();
    z.registerRoleExpiry("role-1", null);
    const r = await z.verifyRoleExpiry("role-1", Date.now());
    expect(r.valid).toBe(true);
    expect(r.expired).toBe(false);
  });
});

describe("Sprint 46 — workspace_id FK", () => {
  it("sql", () => expect(sql142).toMatch(/REFERENCES public\.workspaces/i));
});

describe("Sprint 46 — ENABLE RLS", () => {
  it("sql", () => expect(sql142).toMatch(/ENABLE ROW LEVEL SECURITY/i));
});

describe("Sprint 46 — COMMENT", () => {
  it("present", () => expect(sql142).toMatch(/COMMENT ON TABLE/i));
});

describe("Sprint 46 — active before expiry", () => {
  it("valid", async () => {
    const band = new TemporalRlsPhase2Band(new Zone2WorkspaceServiceStub());
    const now = Date.now();
    const r = await band.grantRole(WS, U1, "reviewer", now + 60_000);
    expect(await band.checkRoleValidity(r.id, now + 1000)).toBe(true);
  });
});

describe("Sprint 46 — revoke unknown", () => {
  it("false", () => {
    const band = new TemporalRlsPhase2Band(new Zone2WorkspaceServiceStub());
    expect(band.revokeRole("missing")).toBe(false);
  });
});

describe("Sprint 46 — role kinds", () => {
  it.each(["owner", "admin", "reviewer", "viewer"] as const)("role %s", async (role) => {
    const band = new TemporalRlsPhase2Band(new Zone2WorkspaceServiceStub());
    const r = await band.grantRole(WS, U1, role, null);
    expect(r.role).toBe(role);
  });
});

describe("Sprint 46 — write policy", () => {
  it("sql", () => expect(sql142).toMatch(/workspace_member_roles_ws_write/i));
});

describe("Sprint 46 — user_id column", () => {
  it("not null", () => expect(sql142).toMatch(/user_id\s+UUID NOT NULL/i));
});

describe("Sprint 46 — enforceExpiry unknown", () => {
  it("false", () => {
    const band = new TemporalRlsPhase2Band(new Zone2WorkspaceServiceStub());
    expect(band.enforceExpiry("nope")).toBe(false);
  });
});

describe("Sprint 46 — granted_at column", () => {
  it("timestamptz", () => expect(sql142).toMatch(/granted_at\s+TIMESTAMPTZ NOT NULL/i));
});

describe("Sprint 46 — role column enum", () => {
  it("uses kind", () => expect(sql142).toMatch(/workspace_member_role_kind/i));
});

describe("Sprint 46 — primary key", () => {
  it("uuid", () => expect(sql142).toMatch(/id\s+UUID PRIMARY KEY/i));
});

describe("Sprint 46 — list empty workspace", () => {
  it("none", async () => {
    const band = new TemporalRlsPhase2Band(new Zone2WorkspaceServiceStub());
    expect(band.listActiveMembers("empty-ws")).toHaveLength(0);
  });
});

describe("Sprint 46 — grant stores workspace", () => {
  it("workspace id", async () => {
    const band = new TemporalRlsPhase2Band(new Zone2WorkspaceServiceStub());
    const r = await band.grantRole(WS, U1, "admin", null);
    expect(r.workspaceId).toBe(WS);
  });
});

describe("Sprint 46 — stub expired role", () => {
  it("expired true", async () => {
    const z = new Zone2WorkspaceServiceStub();
    const exp = Date.now() + 1000;
    z.registerRoleExpiry("r1", exp);
    const r = await z.verifyRoleExpiry("r1", exp + 1);
    expect(r.expired).toBe(true);
    expect(r.valid).toBe(false);
  });
});

describe("Sprint 46 — checkRoleValidity unknown", () => {
  it("false", async () => {
    const band = new TemporalRlsPhase2Band(new Zone2WorkspaceServiceStub());
    expect(await band.checkRoleValidity("missing")).toBe(false);
  });
});

describe("Sprint 46 — grantedAtMs set", () => {
  it("on grant", async () => {
    const band = new TemporalRlsPhase2Band(new Zone2WorkspaceServiceStub());
    const now = Date.now();
    const r = await band.grantRole(WS, U1, "viewer", null, now);
    expect(r.grantedAtMs).toBe(now);
  });
});

describe("Sprint 46 — revoke twice", () => {
  it("false second", async () => {
    const band = new TemporalRlsPhase2Band(new Zone2WorkspaceServiceStub());
    const r = await band.grantRole(WS, U1, "viewer", null);
    band.revokeRole(r.id);
    expect(band.revokeRole(r.id)).toBe(false);
  });
});

describe("Sprint 46 — write policy uses can_write_workspace", () => {
  it("sql", () => expect(sql142).toMatch(/current_user_can_write_workspace/i));
});

describe("Sprint 46 — expires nullable", () => {
  it("sql", () => expect(sql142).toMatch(/expires_at\s+TIMESTAMPTZ/i));
});

describe("Sprint 46 — 30 day grant", () => {
  it("future expiry", async () => {
    const band = new TemporalRlsPhase2Band(new Zone2WorkspaceServiceStub());
    const thirtyDays = 30 * 86_400_000;
    const r = await band.grantRole(WS, U1, "reviewer", Date.now() + thirtyDays);
    expect(r.expiresAtMs).toBeGreaterThan(Date.now());
  });
});

describe("Sprint 46 — list includes admin", () => {
  it("active", async () => {
    const band = new TemporalRlsPhase2Band(new Zone2WorkspaceServiceStub());
    await band.grantRole(WS, U1, "admin", null);
    expect(band.listActiveMembers(WS).some((m) => m.role === "admin")).toBe(true);
  });
});

describe("Sprint 46 — user id on record", () => {
  it("set", async () => {
    const band = new TemporalRlsPhase2Band(new Zone2WorkspaceServiceStub());
    const r = await band.grantRole(WS, U1, "owner", null);
    expect(r.userId).toBe(U1);
  });
});

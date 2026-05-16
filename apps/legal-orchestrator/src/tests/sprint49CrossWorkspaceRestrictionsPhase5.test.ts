import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CrossWorkspaceRestrictionsPhase5Band } from "../coherentSystem/crossWorkspaceRestrictionsPhase5.js";
import { Zone2WorkspaceServiceStub } from "../coherentSystem/zone2WorkspaceStub.js";
import { delegatingZone2Workspace } from "./helpers/zone2WorkspaceTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql145 = readFileSync(join(__dirname, "../../db/migrations/145_sprint49_cross_workspace_restrictions_phase5.sql"), "utf8");
const WS_A = "00000000-0000-4000-8000-0000000000a1";
const WS_B = "00000000-0000-4000-8000-0000000000b2";
const U1 = "00000000-0000-4000-8000-000000000001";

describe("migration 145", () => {
  it("workspace_isolation_policy", () => expect(sql145).toMatch(/workspace_isolation_policy/i));
  it("policy enum", () => expect(sql145).toMatch(/workspace_isolation_policy_kind/i));
  it("indexes", () => {
    expect(sql145).toMatch(/idx_workspace_isolation_ws/i);
    expect(sql145).toMatch(/idx_workspace_isolation_type/i);
  });
  it("admin RLS", () => expect(sql145).toMatch(/workspace_isolation_policy_admin_all/i));
});

describe("Sprint 49 — data isolation", () => {
  it("filters rows", async () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    const rows = [
      { workspaceId: WS_A, id: "1" },
      { workspaceId: WS_B, id: "2" },
    ];
    const out = await band.enforceDataIsolation(WS_A, rows);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe("1");
  });
});

describe("Sprint 49 — user isolation", () => {
  it("cannot see other workspace members", () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    band.registerMember(WS_A, U1);
    band.registerMember(WS_B, "other-user");
    expect(band.enforceUserIsolation(WS_A, WS_B)).toHaveLength(0);
    expect(band.enforceUserIsolation(WS_A, WS_A)).toContain(U1);
  });
});

describe("Sprint 49 — cross workspace query", () => {
  it("rejects multi workspace", () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    expect(() => band.validateCrossWorkspaceQuery([WS_A, WS_B])).toThrow(/multiple workspaces/i);
  });
});

describe("Sprint 49 — blockCrossWorkspaceAccess", () => {
  it("blocks different workspaces", async () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    expect(await band.blockCrossWorkspaceAccess(WS_A, WS_B)).toBe(true);
  });
  it("same workspace not blocked", async () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    expect(await band.blockCrossWorkspaceAccess(WS_A, WS_A)).toBe(false);
  });
});

describe("Sprint 49 — compliance", () => {
  it("all policies enabled", () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    band.enablePolicy(WS_A, "data_isolation");
    band.enablePolicy(WS_A, "user_isolation");
    band.enablePolicy(WS_A, "audit_isolation");
    expect(band.checkIsolationCompliance(WS_A)).toBe(true);
  });
});

describe("Sprint 49 — multi workspace member", () => {
  it("isolation still enforced", async () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    band.registerMember(WS_A, U1);
    band.registerMember(WS_B, U1);
    const rows = [
      { workspaceId: WS_A, v: 1 },
      { workspaceId: WS_B, v: 2 },
    ];
    expect((await band.enforceDataIsolation(WS_A, rows)).every((r) => r.workspaceId === WS_A)).toBe(true);
  });
});

describe("Sprint 49 — remote spy", () => {
  it("validateIsolationPolicy", async () => {
    const spy = vi.fn(async (a: string, b: string) => new Zone2WorkspaceServiceStub().validateIsolationPolicy(a, b));
    const band = new CrossWorkspaceRestrictionsPhase5Band(delegatingZone2Workspace({ validateIsolationPolicy: spy }));
    await band.blockCrossWorkspaceAccess(WS_A, WS_B);
    expect(spy).toHaveBeenCalled();
  });
});

describe("Sprint 49 — index export", () => {
  it("crossWorkspaceRestrictionsPhase5Band", async () => {
    const idx = await import("../coherentSystem/index.js");
    expect(idx.crossWorkspaceRestrictionsPhase5Band).toBeDefined();
  });
});

describe("Sprint 49 — enabled flag", () => {
  it("true", () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    expect(band.enablePolicy(WS_A, "data_isolation").enabled).toBe(true);
  });
});

describe("Sprint 49 — down migration", () => {
  it("drops policy", () => {
    const d = readFileSync(join(__dirname, "../../db/migrations/145_sprint49_cross_workspace_restrictions_phase5.down.sql"), "utf8");
    expect(d).toMatch(/DROP POLICY/i);
  });
});

describe("Sprint 49 — enforced_at", () => {
  it("sql", () => expect(sql145).toMatch(/enforced_at\s+TIMESTAMPTZ/i));
});

describe("Sprint 49 — ENABLE RLS", () => {
  it("sql", () => expect(sql145).toMatch(/ENABLE ROW LEVEL SECURITY/i));
});

describe("Sprint 49 — COMMENT", () => {
  it("present", () => expect(sql145).toMatch(/COMMENT ON TABLE/i));
});

describe("Sprint 49 — single workspace query ok", () => {
  it("no throw", () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    expect(() => band.validateCrossWorkspaceQuery([WS_A])).not.toThrow();
  });
});

describe("Sprint 49 — incomplete compliance", () => {
  it("false", () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    band.enablePolicy(WS_A, "data_isolation");
    expect(band.checkIsolationCompliance(WS_A)).toBe(false);
  });
});

describe("Sprint 49 — workspace_id FK", () => {
  it("sql", () => expect(sql145).toMatch(/REFERENCES public\.workspaces/i));
});

describe("Sprint 49 — admin policy", () => {
  it("admin fn", () => expect(sql145).toMatch(/current_app_user_is_admin/i));
});

describe("Sprint 49 — audit isolation policy type", () => {
  it("enum value", () => expect(sql145).toMatch(/audit_isolation/i));
});

describe("Sprint 49 — stub same workspace", () => {
  it("isolated", async () => {
    const z = new Zone2WorkspaceServiceStub();
    const r = await z.validateIsolationPolicy(WS_A, WS_A);
    expect(r.isolated).toBe(true);
  });
});

describe("Sprint 49 — empty members other ws", () => {
  it("empty", () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    expect(band.enforceUserIsolation(WS_A, WS_B)).toEqual([]);
  });
});

describe("Sprint 49 — policy id format", () => {
  it("includes type", () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    const p = band.enablePolicy(WS_A, "user_isolation");
    expect(p.id).toContain("user_isolation");
  });
});

describe("Sprint 49 — enabled column", () => {
  it("boolean", () => expect(sql145).toMatch(/enabled\s+BOOLEAN NOT NULL/i));
});

describe("Sprint 49 — data_isolation enum", () => {
  it("sql", () => expect(sql145).toMatch(/data_isolation/i));
});

describe("Sprint 49 — user_isolation enum", () => {
  it("sql", () => expect(sql145).toMatch(/user_isolation/i));
});

describe("Sprint 49 — primary key uuid", () => {
  it("sql", () => expect(sql145).toMatch(/id\s+UUID PRIMARY KEY/i));
});

describe("Sprint 49 — empty data rows", () => {
  it("none", async () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    expect(await band.enforceDataIsolation(WS_A, [])).toEqual([]);
  });
});

describe("Sprint 49 — register multiple members same ws", () => {
  it("both visible", () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    band.registerMember(WS_A, U1);
    band.registerMember(WS_A, "u2");
    expect(band.enforceUserIsolation(WS_A, WS_A)).toHaveLength(2);
  });
});

describe("Sprint 49 — policy enforcedAtMs", () => {
  it("recent", () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    const before = Date.now();
    const p = band.enablePolicy(WS_A, "audit_isolation");
    expect(p.enforcedAtMs).toBeGreaterThanOrEqual(before - 5);
  });
});

describe("Sprint 49 — stub invalid ids", () => {
  it("not isolated", async () => {
    const z = new Zone2WorkspaceServiceStub();
    expect((await z.validateIsolationPolicy("", WS_B)).isolated).toBe(false);
  });
});

describe("Sprint 49 — validate empty query list", () => {
  it("throws on multi only", () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    expect(() => band.validateCrossWorkspaceQuery([])).not.toThrow();
  });
});

describe("Sprint 49 — duplicate workspace query", () => {
  it("single unique ok", () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    expect(() => band.validateCrossWorkspaceQuery([WS_A, WS_A])).not.toThrow();
  });
});

describe("Sprint 49 — data isolation all match", () => {
  it("length preserved", async () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    const rows = [
      { workspaceId: WS_A, v: 1 },
      { workspaceId: WS_A, v: 2 },
    ];
    expect((await band.enforceDataIsolation(WS_A, rows)).length).toBe(2);
  });
});

describe("Sprint 49 — policy workspace id", () => {
  it("set", () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    expect(band.enablePolicy(WS_A, "data_isolation").workspaceId).toBe(WS_A);
  });
});

describe("Sprint 49 — block invalid pair", () => {
  it("false", async () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    expect(await band.blockCrossWorkspaceAccess("", WS_B)).toBe(false);
  });
});

describe("Sprint 49 — user isolation policy enabled", () => {
  it("compliance partial", () => {
    const band = new CrossWorkspaceRestrictionsPhase5Band(new Zone2WorkspaceServiceStub());
    band.enablePolicy(WS_A, "user_isolation");
    expect(band.checkIsolationCompliance(WS_A)).toBe(false);
  });
});

describe("Sprint 49 — FOR ALL admin", () => {
  it("sql", () => expect(sql145).toMatch(/FOR ALL/i));
});

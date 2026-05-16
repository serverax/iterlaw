import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WorkspaceIsolationPhase1Band } from "../coherentSystem/workspaceIsolationPhase1.js";
import { Zone2WorkspaceServiceStub } from "../coherentSystem/zone2WorkspaceStub.js";
import { delegatingZone2Workspace } from "./helpers/zone2WorkspaceTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql141 = readFileSync(join(__dirname, "../../db/migrations/141_sprint45_workspace_isolation_phase1.sql"), "utf8");
const U1 = "00000000-0000-4000-8000-000000000001";
const U2 = "00000000-0000-4000-8000-000000000002";

describe("migration 141", () => {
  it("workspaces table", () => expect(sql141).toMatch(/CREATE TABLE IF NOT EXISTS public\.workspaces/i));
  it("columns", () => {
    expect(sql141).toMatch(/owner_user_id/i);
    expect(sql141).toMatch(/metadata\s+JSONB/i);
    expect(sql141).toMatch(/created_at/i);
  });
  it("indexes owner created_at", () => {
    expect(sql141).toMatch(/idx_workspaces_sprint45_owner/i);
    expect(sql141).toMatch(/idx_workspaces_sprint45_created_at/i);
  });
  it("authenticated select policy", () => expect(sql141).toMatch(/workspaces_sprint45_authenticated_select/i));
  it("down drops policies", () => {
    const d = readFileSync(join(__dirname, "../../db/migrations/141_sprint45_workspace_isolation_phase1.down.sql"), "utf8");
    expect(d).toMatch(/DROP POLICY/i);
  });
});

describe("Sprint 45 — createWorkspace", () => {
  it("creates record", async () => {
    const band = new WorkspaceIsolationPhase1Band(new Zone2WorkspaceServiceStub());
    const ws = await band.createWorkspace(U1, "Smith v. Acme", { tier: "pro" });
    expect(ws.name).toBe("Smith v. Acme");
    expect(ws.ownerUserId).toBe(U1);
    expect(ws.metadata.tier).toBe("pro");
  });
  it("uuid id", async () => {
    const band = new WorkspaceIsolationPhase1Band(new Zone2WorkspaceServiceStub());
    const ws = await band.createWorkspace(U1, "A");
    expect(ws.id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("Sprint 45 — listUserWorkspaces", () => {
  it("filters by owner", async () => {
    const band = new WorkspaceIsolationPhase1Band(new Zone2WorkspaceServiceStub());
    await band.createWorkspace(U1, "A");
    await band.createWorkspace(U2, "B");
    expect(band.listUserWorkspaces(U1)).toHaveLength(1);
  });
});

describe("Sprint 45 — fetchWorkspaceById", () => {
  it("hit and miss", async () => {
    const band = new WorkspaceIsolationPhase1Band(new Zone2WorkspaceServiceStub());
    const ws = await band.createWorkspace(U1, "X");
    expect(band.fetchWorkspaceById(ws.id)?.name).toBe("X");
    expect(band.fetchWorkspaceById("00000000-0000-4000-8000-000000009999")).toBeNull();
  });
});

describe("Sprint 45 — validateWorkspaceAccess", () => {
  it("owner allowed", async () => {
    const band = new WorkspaceIsolationPhase1Band(new Zone2WorkspaceServiceStub());
    const ws = await band.createWorkspace(U1, "A");
    expect(await band.validateWorkspaceAccess(U1, ws.id)).toBe(true);
  });
  it("forbidden user denied", async () => {
    const band = new WorkspaceIsolationPhase1Band(new Zone2WorkspaceServiceStub());
    const ws = await band.createWorkspace(U1, "A");
    expect(await band.validateWorkspaceAccess("forbidden-user", ws.id)).toBe(false);
  });
});

describe("Sprint 45 — metadata", () => {
  it("update merges", async () => {
    const band = new WorkspaceIsolationPhase1Band(new Zone2WorkspaceServiceStub());
    const ws = await band.createWorkspace(U1, "A", { a: 1 });
    const next = band.updateMetadata(ws.id, { b: 2 });
    expect(next?.metadata).toEqual({ a: 1, b: 2 });
  });
});

describe("Sprint 45 — zone2 spy", () => {
  it("validateWorkspaceOwnership", async () => {
    const spy = vi.fn(async (u: string, w: string) =>
      new Zone2WorkspaceServiceStub().validateWorkspaceOwnership(u, w),
    );
    const band = new WorkspaceIsolationPhase1Band(delegatingZone2Workspace({ validateWorkspaceOwnership: spy }));
    const ws = await band.createWorkspace(U1, "A");
    await band.validateWorkspaceAccess(U2, ws.id);
    expect(spy).toHaveBeenCalled();
  });
});

describe("Sprint 45 — index export", () => {
  it("workspaceIsolationPhase1Band", async () => {
    const idx = await import("../coherentSystem/index.js");
    expect(idx.workspaceIsolationPhase1Band).toBeDefined();
  });
});

describe("Sprint 45 — multiple workspaces per user", () => {
  it("two owned", async () => {
    const band = new WorkspaceIsolationPhase1Band(new Zone2WorkspaceServiceStub());
    await band.createWorkspace(U1, "A");
    await band.createWorkspace(U1, "B");
    expect(band.listUserWorkspaces(U1)).toHaveLength(2);
  });
});

describe("Sprint 45 — ENABLE RLS", () => {
  it("sql", () => expect(sql141).toMatch(/ENABLE ROW LEVEL SECURITY/i));
});

describe("Sprint 45 — owner insert policy", () => {
  it("sql", () => expect(sql141).toMatch(/workspaces_sprint45_owner_insert/i));
});

describe("Sprint 45 — createdAtMs", () => {
  it("recent", async () => {
    const band = new WorkspaceIsolationPhase1Band(new Zone2WorkspaceServiceStub());
    const before = Date.now();
    const ws = await band.createWorkspace(U1, "A");
    expect(ws.createdAtMs).toBeGreaterThanOrEqual(before - 5);
  });
});

describe("Sprint 45 — stub ownership", () => {
  it("valid", async () => {
    const z = new Zone2WorkspaceServiceStub();
    const r = await z.validateWorkspaceOwnership(U1, "ws-1");
    expect(r.valid).toBe(true);
  });
});

describe("Sprint 45 — partition key", () => {
  it("workspace id stable", async () => {
    const band = new WorkspaceIsolationPhase1Band(new Zone2WorkspaceServiceStub());
    const ws = await band.createWorkspace(U1, "Case partition");
    expect(band.fetchWorkspaceById(ws.id)?.id).toBe(ws.id);
  });
});

describe("Sprint 45 — name trim", () => {
  it("trimmed", async () => {
    const band = new WorkspaceIsolationPhase1Band(new Zone2WorkspaceServiceStub());
    const ws = await band.createWorkspace(U1, "  spaced  ");
    expect(ws.name).toBe("spaced");
  });
});

describe("Sprint 45 — COMMENT", () => {
  it("present", () => expect(sql141).toMatch(/COMMENT ON TABLE/i));
});

describe("Sprint 45 — owner_user_id NOT NULL", () => {
  it("sql", () => expect(sql141).toMatch(/owner_user_id\s+UUID NOT NULL/i));
});

describe("Sprint 45 — access miss unknown workspace", () => {
  it("false", async () => {
    const band = new WorkspaceIsolationPhase1Band(new Zone2WorkspaceServiceStub());
    expect(await band.validateWorkspaceAccess(U1, "00000000-0000-4000-8000-000000000099")).toBe(false);
  });
});

describe("Sprint 45 — metadata update miss", () => {
  it("null", () => {
    const band = new WorkspaceIsolationPhase1Band(new Zone2WorkspaceServiceStub());
    expect(band.updateMetadata("missing", { x: 1 })).toBeNull();
  });
});

describe("Sprint 45 — name column", () => {
  it("not null", () => expect(sql141).toMatch(/name\s+TEXT NOT NULL/i));
});

describe("Sprint 45 — metadata jsonb default", () => {
  it("default empty object", () => expect(sql141).toMatch(/metadata\s+JSONB NOT NULL DEFAULT/i));
});

describe("Sprint 45 — list empty user", () => {
  it("no workspaces", () => {
    const band = new WorkspaceIsolationPhase1Band(new Zone2WorkspaceServiceStub());
    expect(band.listUserWorkspaces("nobody")).toHaveLength(0);
  });
});

describe("Sprint 45 — blocked workspace id", () => {
  it("remote invalid", async () => {
    const band = new WorkspaceIsolationPhase1Band(new Zone2WorkspaceServiceStub());
    expect(await band.validateWorkspaceAccess(U1, "blocked-ws-id")).toBe(false);
  });
});

describe("Sprint 45 — owner insert check", () => {
  it("current_app_user_id", () => expect(sql141).toMatch(/owner_user_id = public\.current_app_user_id/i));
});

describe("Sprint 45 — primary key", () => {
  it("uuid", () => expect(sql141).toMatch(/id\s+UUID PRIMARY KEY/i));
});

describe("Sprint 45 — frozen metadata", () => {
  it("immutable spread", async () => {
    const band = new WorkspaceIsolationPhase1Band(new Zone2WorkspaceServiceStub());
    const ws = await band.createWorkspace(U1, "A", { k: 1 });
    expect(Object.isFrozen(ws.metadata)).toBe(true);
  });
});

describe("Sprint 45 — two users isolation", () => {
  it("lists disjoint", async () => {
    const band = new WorkspaceIsolationPhase1Band(new Zone2WorkspaceServiceStub());
    await band.createWorkspace(U1, "A");
    await band.createWorkspace(U2, "B");
    expect(band.listUserWorkspaces(U1).some((w) => w.ownerUserId === U2)).toBe(false);
  });
});

describe("Sprint 45 — fetch after create", () => {
  it("same reference fields", async () => {
    const band = new WorkspaceIsolationPhase1Band(new Zone2WorkspaceServiceStub());
    const ws = await band.createWorkspace(U1, "Z");
    expect(band.fetchWorkspaceById(ws.id)?.ownerUserId).toBe(U1);
  });
});

describe("Sprint 45 — stub blocked workspace", () => {
  it("invalid", async () => {
    const z = new Zone2WorkspaceServiceStub();
    expect((await z.validateWorkspaceOwnership(U1, "blocked")).valid).toBe(false);
  });
});

describe("Sprint 45 — metadata empty object", () => {
  it("default", async () => {
    const band = new WorkspaceIsolationPhase1Band(new Zone2WorkspaceServiceStub());
    const ws = await band.createWorkspace(U1, "A");
    expect(ws.metadata).toEqual({});
  });
});

describe("Sprint 45 — created_at default", () => {
  it("sql", () => expect(sql141).toMatch(/created_at.*DEFAULT now\(\)/is));
});

describe("Sprint 45 — users FK", () => {
  it("references users", () => expect(sql141).toMatch(/REFERENCES public\.users/i));
});

describe("Sprint 45 — validate access owner shortcut", () => {
  it("no remote needed", async () => {
    const spy = vi.fn();
    const band = new WorkspaceIsolationPhase1Band(delegatingZone2Workspace({ validateWorkspaceOwnership: spy }));
    const ws = await band.createWorkspace(U1, "A");
    expect(await band.validateWorkspaceAccess(U1, ws.id)).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("Sprint 45 — long name", () => {
  it("stored", async () => {
    const band = new WorkspaceIsolationPhase1Band(new Zone2WorkspaceServiceStub());
    const name = "Matter ".repeat(20).trim();
    const ws = await band.createWorkspace(U1, name);
    expect(ws.name).toBe(name);
  });
});

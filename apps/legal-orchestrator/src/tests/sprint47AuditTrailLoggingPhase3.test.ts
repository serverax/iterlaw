import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AuditTrailLoggingPhase3Band } from "../coherentSystem/auditTrailLoggingPhase3.js";
import { Zone2WorkspaceServiceStub } from "../coherentSystem/zone2WorkspaceStub.js";
import { delegatingZone2Workspace } from "./helpers/zone2WorkspaceTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql143 = readFileSync(join(__dirname, "../../db/migrations/143_sprint47_audit_trail_phase3.sql"), "utf8");
const WS = "00000000-0000-4000-8000-0000000000a1";
const U1 = "00000000-0000-4000-8000-000000000001";

describe("migration 143", () => {
  it("workspace_audit_log", () => expect(sql143).toMatch(/workspace_audit_log/i));
  it("columns", () => {
    expect(sql143).toMatch(/actor_user_id/i);
    expect(sql143).toMatch(/resource_type/i);
    expect(sql143).toMatch(/changes\s+JSONB/i);
    expect(sql143).toMatch(/timestamp/i);
  });
  it("indexes", () => {
    expect(sql143).toMatch(/idx_workspace_audit_ws_time/i);
    expect(sql143).toMatch(/idx_workspace_audit_actor/i);
    expect(sql143).toMatch(/idx_workspace_audit_timestamp/i);
  });
  it("insert policy", () => expect(sql143).toMatch(/workspace_audit_log_ws_insert/i));
});

describe("Sprint 47 — logAction", () => {
  it("logs update_case", async () => {
    const band = new AuditTrailLoggingPhase3Band(new Zone2WorkspaceServiceStub());
    const e = await band.logAction({
      workspaceId: WS,
      actorUserId: U1,
      action: "update_case",
      resourceType: "case",
      resourceId: "case-1",
      changes: { status: { from: "draft", to: "submitted" } },
    });
    expect(e.action).toBe("update_case");
    expect(e.changes.status).toEqual({ from: "draft", to: "submitted" });
  });
});

describe("Sprint 47 — immutability", () => {
  it("attemptMutate throws", async () => {
    const band = new AuditTrailLoggingPhase3Band(new Zone2WorkspaceServiceStub());
    const e = await band.logAction({
      workspaceId: WS,
      actorUserId: U1,
      action: "create_case",
      resourceType: "case",
      resourceId: "c1",
    });
    expect(() => band.attemptMutate(e.id)).toThrow(/cannot be updated/i);
  });
  it("verifyImmutability true", () => {
    const band = new AuditTrailLoggingPhase3Band(new Zone2WorkspaceServiceStub());
    expect(band.verifyImmutability()).toBe(true);
  });
});

describe("Sprint 47 — filterByDateRange", () => {
  it("filters", async () => {
    const band = new AuditTrailLoggingPhase3Band(new Zone2WorkspaceServiceStub());
    const t0 = Date.now();
    await band.logAction({ workspaceId: WS, actorUserId: U1, action: "a", resourceType: "case", resourceId: "1" });
    const rows = band.filterByDateRange(WS, t0 - 1, t0 + 10_000);
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Sprint 47 — exportAuditTrail", () => {
  it("json array", async () => {
    const band = new AuditTrailLoggingPhase3Band(new Zone2WorkspaceServiceStub());
    await band.logAction({ workspaceId: WS, actorUserId: U1, action: "a", resourceType: "case", resourceId: "1" });
    const raw = band.exportAuditTrail(WS);
    expect(JSON.parse(raw)).toHaveLength(1);
  });
});

describe("Sprint 47 — workspace scope", () => {
  it("isolated logs", async () => {
    const band = new AuditTrailLoggingPhase3Band(new Zone2WorkspaceServiceStub());
    await band.logAction({ workspaceId: WS, actorUserId: U1, action: "a", resourceType: "case", resourceId: "1" });
    await band.logAction({
      workspaceId: "00000000-0000-4000-8000-0000000000b2",
      actorUserId: U1,
      action: "b",
      resourceType: "case",
      resourceId: "2",
    });
    expect(band.fetchAuditLog(WS)).toHaveLength(1);
  });
});

describe("Sprint 47 — remote spy", () => {
  it("sendAuditEventToRemote", async () => {
    const spy = vi.fn(async (a: string, rt: string, rid: string, c: Record<string, unknown>) =>
      new Zone2WorkspaceServiceStub().sendAuditEventToRemote(a, rt, rid, c),
    );
    const band = new AuditTrailLoggingPhase3Band(delegatingZone2Workspace({ sendAuditEventToRemote: spy }));
    await band.logAction({ workspaceId: WS, actorUserId: U1, action: "x", resourceType: "case", resourceId: "1" });
    expect(spy).toHaveBeenCalled();
  });
});

describe("Sprint 47 — index export", () => {
  it("auditTrailLoggingPhase3Band", async () => {
    const idx = await import("../coherentSystem/index.js");
    expect(idx.auditTrailLoggingPhase3Band).toBeDefined();
  });
});

describe("Sprint 47 — concurrent logging", () => {
  it("race safe append", async () => {
    const band = new AuditTrailLoggingPhase3Band(new Zone2WorkspaceServiceStub());
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        band.logAction({ workspaceId: WS, actorUserId: U1, action: `a${i}`, resourceType: "case", resourceId: `${i}` }),
      ),
    );
    expect(band.fetchAuditLog(WS)).toHaveLength(5);
  });
});

describe("Sprint 47 — timestamp default", () => {
  it("sql", () => expect(sql143).toMatch(/timestamp.*DEFAULT now\(\)/is));
});

describe("Sprint 47 — down migration", () => {
  it("drops policies", () => {
    const d = readFileSync(join(__dirname, "../../db/migrations/143_sprint47_audit_trail_phase3.down.sql"), "utf8");
    expect(d).toMatch(/DROP POLICY/i);
  });
});

describe("Sprint 47 — ENABLE RLS", () => {
  it("sql", () => expect(sql143).toMatch(/ENABLE ROW LEVEL SECURITY/i));
});

describe("Sprint 47 — COMMENT", () => {
  it("present", () => expect(sql143).toMatch(/COMMENT ON TABLE/i));
});

describe("Sprint 47 — action varchar", () => {
  it("sql", () => expect(sql143).toMatch(/action\s+VARCHAR/i));
});

describe("Sprint 47 — empty changes default", () => {
  it("object", async () => {
    const band = new AuditTrailLoggingPhase3Band(new Zone2WorkspaceServiceStub());
    const e = await band.logAction({
      workspaceId: WS,
      actorUserId: U1,
      action: "delete_case",
      resourceType: "case",
      resourceId: "c",
    });
    expect(e.changes).toEqual({});
  });
});

describe("Sprint 47 — stub event id", () => {
  it("prefix", async () => {
    const z = new Zone2WorkspaceServiceStub();
    const r = await z.sendAuditEventToRemote("create_case", "case", "1", {});
    expect(r.eventId).toMatch(/^audit:/);
  });
});

describe("Sprint 47 — fetchAuditLog order", () => {
  it("append order", async () => {
    const band = new AuditTrailLoggingPhase3Band(new Zone2WorkspaceServiceStub());
    const a = await band.logAction({ workspaceId: WS, actorUserId: U1, action: "1", resourceType: "case", resourceId: "1" });
    const b = await band.logAction({ workspaceId: WS, actorUserId: U1, action: "2", resourceType: "case", resourceId: "2" });
    const log = band.fetchAuditLog(WS);
    expect(log[0]!.id).toBe(a.id);
    expect(log[1]!.id).toBe(b.id);
  });
});

describe("Sprint 47 — workspace select policy", () => {
  it("sql", () => expect(sql143).toMatch(/workspace_audit_log_ws_select/i));
});

describe("Sprint 47 — resource_id text", () => {
  it("sql", () => expect(sql143).toMatch(/resource_id\s+TEXT NOT NULL/i));
});

describe("Sprint 47 — filter empty range", () => {
  it("none", async () => {
    const band = new AuditTrailLoggingPhase3Band(new Zone2WorkspaceServiceStub());
    await band.logAction({ workspaceId: WS, actorUserId: U1, action: "a", resourceType: "case", resourceId: "1" });
    expect(band.filterByDateRange(WS, Date.now() + 1000, Date.now() + 2000)).toHaveLength(0);
  });
});

describe("Sprint 47 — share_case action", () => {
  it("logged", async () => {
    const band = new AuditTrailLoggingPhase3Band(new Zone2WorkspaceServiceStub());
    const e = await band.logAction({
      workspaceId: WS,
      actorUserId: U1,
      action: "share_case",
      resourceType: "case",
      resourceId: "c1",
    });
    expect(e.action).toBe("share_case");
  });
});

describe("Sprint 47 — primary key", () => {
  it("uuid", () => expect(sql143).toMatch(/id\s+UUID PRIMARY KEY/i));
});

describe("Sprint 47 — changes default jsonb", () => {
  it("empty object default", () => expect(sql143).toMatch(/changes\s+JSONB NOT NULL DEFAULT/i));
});

describe("Sprint 47 — actor FK", () => {
  it("users", () => expect(sql143).toMatch(/actor_user_id\s+UUID NOT NULL REFERENCES public\.users/i));
});

describe("Sprint 47 — note resource type", () => {
  it("logged", async () => {
    const band = new AuditTrailLoggingPhase3Band(new Zone2WorkspaceServiceStub());
    const e = await band.logAction({
      workspaceId: WS,
      actorUserId: U1,
      action: "update_case",
      resourceType: "note",
      resourceId: "n1",
    });
    expect(e.resourceType).toBe("note");
  });
});

describe("Sprint 47 — document resource", () => {
  it("logged", async () => {
    const band = new AuditTrailLoggingPhase3Band(new Zone2WorkspaceServiceStub());
    const e = await band.logAction({
      workspaceId: WS,
      actorUserId: U1,
      action: "create_case",
      resourceType: "document",
      resourceId: "d1",
    });
    expect(e.resourceType).toBe("document");
  });
});

describe("Sprint 47 — entry id uuid", () => {
  it("format", async () => {
    const band = new AuditTrailLoggingPhase3Band(new Zone2WorkspaceServiceStub());
    const e = await band.logAction({
      workspaceId: WS,
      actorUserId: U1,
      action: "a",
      resourceType: "case",
      resourceId: "1",
    });
    expect(e.id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("Sprint 47 — timestampMs recent", () => {
  it("set", async () => {
    const band = new AuditTrailLoggingPhase3Band(new Zone2WorkspaceServiceStub());
    const before = Date.now();
    const e = await band.logAction({
      workspaceId: WS,
      actorUserId: U1,
      action: "a",
      resourceType: "case",
      resourceId: "1",
    });
    expect(e.timestampMs).toBeGreaterThanOrEqual(before - 5);
  });
});

describe("Sprint 47 — frozen changes", () => {
  it("immutable", async () => {
    const band = new AuditTrailLoggingPhase3Band(new Zone2WorkspaceServiceStub());
    const e = await band.logAction({
      workspaceId: WS,
      actorUserId: U1,
      action: "a",
      resourceType: "case",
      resourceId: "1",
      changes: { x: 1 },
    });
    expect(Object.isFrozen(e.changes)).toBe(true);
  });
});

describe("Sprint 47 — stub rejects empty action", () => {
  it("not accepted", async () => {
    const z = new Zone2WorkspaceServiceStub();
    const r = await z.sendAuditEventToRemote("", "case", "1", {});
    expect(r.accepted).toBe(false);
  });
});

describe("Sprint 47 — delete_case action", () => {
  it("logged", async () => {
    const band = new AuditTrailLoggingPhase3Band(new Zone2WorkspaceServiceStub());
    const e = await band.logAction({
      workspaceId: WS,
      actorUserId: U1,
      action: "delete_case",
      resourceType: "case",
      resourceId: "c",
    });
    expect(e.action).toBe("delete_case");
  });
});

describe("Sprint 47 — export empty workspace", () => {
  it("array", () => {
    const band = new AuditTrailLoggingPhase3Band(new Zone2WorkspaceServiceStub());
    expect(JSON.parse(band.exportAuditTrail("empty"))).toEqual([]);
  });
});

describe("Sprint 47 — workspace FK", () => {
  it("references workspaces", () => expect(sql143).toMatch(/REFERENCES public\.workspaces/i));
});

describe("Sprint 47 — insert check actor", () => {
  it("sql", () => expect(sql143).toMatch(/actor_user_id = public\.current_app_user_id/i));
});

describe("Sprint 47 — mutate missing entry", () => {
  it("throws not found", () => {
    const band = new AuditTrailLoggingPhase3Band(new Zone2WorkspaceServiceStub());
    expect(() => band.attemptMutate("00000000-0000-4000-8000-000000000099")).toThrow(/not found/i);
  });
});

describe("Sprint 47 — multiple actors", () => {
  it("both logged", async () => {
    const band = new AuditTrailLoggingPhase3Band(new Zone2WorkspaceServiceStub());
    await band.logAction({ workspaceId: WS, actorUserId: U1, action: "a", resourceType: "case", resourceId: "1" });
    await band.logAction({
      workspaceId: WS,
      actorUserId: "00000000-0000-4000-8000-000000000002",
      action: "b",
      resourceType: "case",
      resourceId: "2",
    });
    expect(band.fetchAuditLog(WS)).toHaveLength(2);
  });
});

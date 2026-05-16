import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WorkspaceRbacPhase4Band } from "../coherentSystem/workspaceRbacPhase4.js";
import { Zone2WorkspaceServiceStub } from "../coherentSystem/zone2WorkspaceStub.js";
import { delegatingZone2Workspace } from "./helpers/zone2WorkspaceTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql144 = readFileSync(join(__dirname, "../../db/migrations/144_sprint48_workspace_rbac_phase4.sql"), "utf8");
const WS_A = "00000000-0000-4000-8000-0000000000a1";
const WS_B = "00000000-0000-4000-8000-0000000000b2";

describe("migration 144", () => {
  it("workspace_role_permissions", () => expect(sql144).toMatch(/workspace_role_permissions/i));
  it("columns", () => {
    expect(sql144).toMatch(/permission\s+VARCHAR/i);
    expect(sql144).toMatch(/created_at/i);
  });
  it("indexes", () => {
    expect(sql144).toMatch(/idx_workspace_role_permissions_role/i);
    expect(sql144).toMatch(/idx_workspace_role_permissions_perm/i);
  });
  it("public select", () => expect(sql144).toMatch(/workspace_role_permissions_public_select/i));
});

describe("Sprint 48 — owner permissions", () => {
  it("delete_case allowed", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(await band.checkPermission("owner", "delete_case")).toBe(true);
  });
  it("all listed", () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(band.listPermissionsForRole("owner").length).toBeGreaterThanOrEqual(7);
  });
});

describe("Sprint 48 — viewer restrictions", () => {
  it("view only", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(await band.checkPermission("viewer", "view_cases")).toBe(true);
    expect(await band.checkPermission("viewer", "delete_case")).toBe(false);
  });
});

describe("Sprint 48 — admin no delete workspace implied", () => {
  it("no delete_case for admin in matrix", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(await band.checkPermission("admin", "delete_case")).toBe(false);
  });
});

describe("Sprint 48 — reviewer", () => {
  it("edit and share", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(await band.checkPermission("reviewer", "edit_case")).toBe(true);
    expect(await band.checkPermission("reviewer", "create_case")).toBe(false);
  });
});

describe("Sprint 48 — assertPermission", () => {
  it("throws", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    await expect(band.assertPermission("viewer", "manage_members")).rejects.toThrow(/denied/i);
  });
});

describe("Sprint 48 — cross workspace", () => {
  it("viewer A cannot act in B", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(await band.canUserPerform("viewer", "view_cases", WS_B, WS_A)).toBe(false);
  });
});

describe("Sprint 48 — escalation prevention", () => {
  it("viewer to owner blocked", () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(band.preventsEscalation("viewer", "owner")).toBe(false);
  });
  it("viewer to reviewer ok", () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(band.preventsEscalation("viewer", "reviewer")).toBe(true);
  });
});

describe("Sprint 48 — remote spy", () => {
  it("resolvePermissionRemote", async () => {
    const spy = vi.fn(async (r: string, p: string) => new Zone2WorkspaceServiceStub().resolvePermissionRemote(r, p));
    const band = new WorkspaceRbacPhase4Band(delegatingZone2Workspace({ resolvePermissionRemote: spy }));
    await band.checkPermission("admin", "view_cases");
    expect(spy).toHaveBeenCalled();
  });
});

describe("Sprint 48 — index export", () => {
  it("workspaceRbacPhase4Band", async () => {
    const idx = await import("../coherentSystem/index.js");
    expect(idx.workspaceRbacPhase4Band).toBeDefined();
  });
});

describe("Sprint 48 — getRolePermissions", () => {
  it("admin includes manage_members", () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(band.getRolePermissions("admin")).toContain("manage_members");
  });
});

describe("Sprint 48 — primary key", () => {
  it("sql", () => expect(sql144).toMatch(/PRIMARY KEY \(role, permission\)/i));
});

describe("Sprint 48 — down migration", () => {
  it("drops policy", () => {
    const d = readFileSync(join(__dirname, "../../db/migrations/144_sprint48_workspace_rbac_phase4.down.sql"), "utf8");
    expect(d).toMatch(/DROP POLICY/i);
  });
});

describe("Sprint 48 — ENABLE RLS", () => {
  it("sql", () => expect(sql144).toMatch(/ENABLE ROW LEVEL SECURITY/i));
});

describe("Sprint 48 — COMMENT", () => {
  it("present", () => expect(sql144).toMatch(/COMMENT ON TABLE/i));
});

describe("Sprint 48 — same workspace allowed", () => {
  it("true", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(await band.canUserPerform("owner", "view_cases", WS_A, WS_A)).toBe(true);
  });
});

describe("Sprint 48 — archive_case owner", () => {
  it("allowed", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(await band.checkPermission("owner", "archive_case")).toBe(true);
  });
});

describe("Sprint 48 — view_audit admin", () => {
  it("allowed", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(await band.checkPermission("admin", "view_audit")).toBe(true);
  });
});

describe("Sprint 48 — stub deny unknown role", () => {
  it("false", async () => {
    const z = new Zone2WorkspaceServiceStub();
    expect((await z.resolvePermissionRemote("unknown", "view_cases")).allowed).toBe(false);
  });
});

describe("Sprint 48 — assert passes", () => {
  it("owner create", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    await expect(band.assertPermission("owner", "create_case")).resolves.toBeUndefined();
  });
});

describe("Sprint 48 — public policy using true", () => {
  it("sql", () => expect(sql144).toMatch(/USING \(true\)/i));
});

describe("Sprint 48 — reviewer no manage", () => {
  it("false", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(await band.checkPermission("reviewer", "manage_members")).toBe(false);
  });
});

describe("Sprint 48 — created_at default", () => {
  it("sql", () => expect(sql144).toMatch(/created_at.*DEFAULT now\(\)/is));
});

describe("Sprint 48 — owner manage_members", () => {
  it("allowed", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(await band.checkPermission("owner", "manage_members")).toBe(true);
  });
});

describe("Sprint 48 — owner share_case", () => {
  it("allowed", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(await band.checkPermission("owner", "share_case")).toBe(true);
  });
});

describe("Sprint 48 — viewer view_audit denied", () => {
  it("false", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(await band.checkPermission("viewer", "view_audit")).toBe(false);
  });
});

describe("Sprint 48 — admin create_case", () => {
  it("allowed", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(await band.checkPermission("admin", "create_case")).toBe(true);
  });
});

describe("Sprint 48 — admin edit_case", () => {
  it("allowed", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(await band.checkPermission("admin", "edit_case")).toBe(true);
  });
});

describe("Sprint 48 — reviewer view_cases", () => {
  it("allowed", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(await band.checkPermission("reviewer", "view_cases")).toBe(true);
  });
});

describe("Sprint 48 — owner to admin escalation allowed", () => {
  it("true", () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(band.preventsEscalation("owner", "admin")).toBe(true);
  });
});

describe("Sprint 48 — admin archive", () => {
  it("allowed", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(await band.checkPermission("admin", "archive_case")).toBe(true);
  });
});

describe("Sprint 48 — role column type", () => {
  it("enum ref", () => expect(sql144).toMatch(/workspace_member_role_kind/i));
});

describe("Sprint 48 — permission varchar", () => {
  it("sql", () => expect(sql144).toMatch(/permission\s+VARCHAR/i));
});

describe("Sprint 48 — listPermissionsForRole viewer", () => {
  it("one perm", () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(band.listPermissionsForRole("viewer")).toEqual(["view_cases"]);
  });
});

describe("Sprint 48 — stub owner delete", () => {
  it("allowed", async () => {
    const z = new Zone2WorkspaceServiceStub();
    expect((await z.resolvePermissionRemote("owner", "delete_case")).allowed).toBe(true);
  });
});

describe("Sprint 48 — cross workspace owner denied", () => {
  it("false", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(await band.canUserPerform("owner", "delete_case", WS_B, WS_A)).toBe(false);
  });
});

describe("Sprint 48 — reviewer share allowed", () => {
  it("true", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(await band.checkPermission("reviewer", "share_case")).toBe(true);
  });
});

describe("Sprint 48 — admin share", () => {
  it("true", async () => {
    const band = new WorkspaceRbacPhase4Band(new Zone2WorkspaceServiceStub());
    expect(await band.checkPermission("admin", "share_case")).toBe(true);
  });
});

import { PERMISSION_MATRIX } from "./zone2WorkspaceStub.js";
import type { Zone2WorkspaceService } from "./zone2WorkspaceTypes.js";
import type { WorkspaceMemberRole } from "./temporalRlsPhase2.js";

export type WorkspacePermission =
  | "view_cases"
  | "create_case"
  | "edit_case"
  | "delete_case"
  | "share_case"
  | "view_audit"
  | "manage_members"
  | "archive_case";

/**
 * Sprint 48 — Workspace RBAC permission matrix.
 */
export class WorkspaceRbacPhase4Band {
  constructor(private readonly zone2: Zone2WorkspaceService) {}

  getRolePermissions(role: WorkspaceMemberRole): readonly string[] {
    return PERMISSION_MATRIX[role] ?? [];
  }

  async checkPermission(role: WorkspaceMemberRole, permission: WorkspacePermission): Promise<boolean> {
    const remote = await this.zone2.resolvePermissionRemote(role, permission);
    return remote.allowed;
  }

  async assertPermission(role: WorkspaceMemberRole, permission: WorkspacePermission): Promise<void> {
    if (!(await this.checkPermission(role, permission))) {
      throw new Error(`permission denied: ${permission} for role ${role}`);
    }
  }

  listPermissionsForRole(role: WorkspaceMemberRole): readonly string[] {
    return this.getRolePermissions(role);
  }

  async canUserPerform(
    role: WorkspaceMemberRole,
    permission: WorkspacePermission,
    workspaceId: string,
    userWorkspaceId: string,
  ): Promise<boolean> {
    if (workspaceId !== userWorkspaceId) {
      return false;
    }
    return await this.checkPermission(role, permission);
  }

  preventsEscalation(from: WorkspaceMemberRole, to: WorkspaceMemberRole): boolean {
    const order: WorkspaceMemberRole[] = ["viewer", "reviewer", "admin", "owner"];
    return order.indexOf(to) <= order.indexOf(from) + 1;
  }
}

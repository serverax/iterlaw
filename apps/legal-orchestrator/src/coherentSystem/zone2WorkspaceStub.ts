import { createHash } from "node:crypto";
import type {
  Zone2AuditEventResult,
  Zone2IsolationValidation,
  Zone2PermissionResolution,
  Zone2RoleExpiryCheck,
  Zone2SettingValidation,
  Zone2WorkspaceOwnershipValidation,
  Zone2WorkspaceService,
} from "./zone2WorkspaceTypes.js";

const PERMISSION_MATRIX: Readonly<Record<string, readonly string[]>> = {
  owner: [
    "view_cases",
    "create_case",
    "edit_case",
    "delete_case",
    "share_case",
    "view_audit",
    "manage_members",
    "archive_case",
  ],
  admin: ["view_cases", "create_case", "edit_case", "share_case", "view_audit", "manage_members", "archive_case"],
  reviewer: ["view_cases", "edit_case", "share_case"],
  viewer: ["view_cases"],
};

/**
 * Deterministic Zone 2 workspace stub — no network I/O.
 */
export class Zone2WorkspaceServiceStub implements Zone2WorkspaceService {
  private readonly roleExpiryMs = new Map<string, number | null>();

  registerRoleExpiry(roleId: string, expiresAtMs: number | null): void {
    this.roleExpiryMs.set(roleId, expiresAtMs);
  }

  async validateWorkspaceOwnership(
    userId: string,
    workspaceId: string,
  ): Promise<Zone2WorkspaceOwnershipValidation> {
    const ok =
      userId.trim().length > 0 &&
      workspaceId.trim().length > 0 &&
      !userId.includes("forbidden") &&
      !workspaceId.includes("blocked");
    return { valid: ok, reason: ok ? "ok" : "ownership denied" };
  }

  async verifyRoleExpiry(roleId: string, currentTimeMs: number): Promise<Zone2RoleExpiryCheck> {
    const expiresAt = this.roleExpiryMs.get(roleId);
    if (expiresAt === undefined) {
      return { valid: false, expired: true };
    }
    if (expiresAt === null) {
      return { valid: true, expired: false };
    }
    const expired = currentTimeMs >= expiresAt;
    return { valid: !expired, expired };
  }

  async sendAuditEventToRemote(
    action: string,
    resourceType: string,
    resourceId: string,
    changes: Readonly<Record<string, unknown>>,
  ): Promise<Zone2AuditEventResult> {
    const digest = createHash("sha256")
      .update(`${action}|${resourceType}|${resourceId}|${JSON.stringify(changes)}`)
      .digest("hex");
    return { accepted: action.trim().length > 0, eventId: `audit:${digest.slice(0, 16)}` };
  }

  async resolvePermissionRemote(role: string, permission: string): Promise<Zone2PermissionResolution> {
    const perms = PERMISSION_MATRIX[role] ?? [];
    return { allowed: perms.includes(permission) };
  }

  async validateIsolationPolicy(workspace1Id: string, workspace2Id: string): Promise<Zone2IsolationValidation> {
    if (workspace1Id === workspace2Id) {
      return { isolated: true, reason: "same workspace" };
    }
    const isolated = workspace1Id.trim().length > 0 && workspace2Id.trim().length > 0;
    return { isolated, reason: isolated ? "ok" : "invalid ids" };
  }

  async validateSettingValue(key: string, value: string): Promise<Zone2SettingValidation> {
    if (key === "timezone") {
      const ok = /^[A-Za-z_]+\/[A-Za-z_]+$/.test(value);
      return { valid: ok, normalized: ok ? value : "UTC" };
    }
    if (key === "language") {
      const ok = /^[a-z]{2}(-[A-Z]{2})?$/.test(value);
      return { valid: ok, normalized: ok ? value : "en" };
    }
    if (key === "retention_days") {
      const n = Number.parseInt(value, 10);
      const ok = Number.isFinite(n) && n >= 30 && n <= 3650;
      return { valid: ok, normalized: ok ? String(n) : "365" };
    }
    if (key === "default_role") {
      const ok = ["owner", "admin", "reviewer", "viewer"].includes(value);
      return { valid: ok, normalized: ok ? value : "viewer" };
    }
    if (key === "case_template") {
      const ok = value.trim().length > 0 && value.length <= 64;
      return { valid: ok, normalized: value.trim() || "default" };
    }
    return { valid: false, normalized: value };
  }
}

export { PERMISSION_MATRIX };

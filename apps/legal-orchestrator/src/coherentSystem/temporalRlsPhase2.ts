import { randomUUID } from "node:crypto";
import type { Zone2WorkspaceService } from "./zone2WorkspaceTypes.js";
import { Zone2WorkspaceServiceStub } from "./zone2WorkspaceStub.js";

export type WorkspaceMemberRole = "owner" | "admin" | "reviewer" | "viewer";

export interface MemberRoleRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: WorkspaceMemberRole;
  readonly grantedAtMs: number;
  readonly expiresAtMs: number | null;
}

/**
 * Sprint 46 — Time-based workspace member roles.
 */
export class TemporalRlsPhase2Band {
  private readonly roles = new Map<string, MemberRoleRecord>();

  constructor(private readonly zone2: Zone2WorkspaceService) {}

  async grantRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceMemberRole,
    expiresAtMs: number | null,
    nowMs = Date.now(),
  ): Promise<MemberRoleRecord> {
    if (expiresAtMs !== null && expiresAtMs <= nowMs) {
      throw new Error("expires_at must be in the future");
    }
    const record: MemberRoleRecord = {
      id: randomUUID(),
      workspaceId,
      userId,
      role,
      grantedAtMs: nowMs,
      expiresAtMs,
    };
    this.roles.set(record.id, record);
    if (this.zone2 instanceof Zone2WorkspaceServiceStub) {
      this.zone2.registerRoleExpiry(record.id, expiresAtMs);
    }
    return record;
  }

  revokeRole(roleId: string): boolean {
    return this.roles.delete(roleId);
  }

  async checkRoleValidity(roleId: string, nowMs = Date.now()): Promise<boolean> {
    const rec = this.roles.get(roleId);
    if (!rec) {
      return false;
    }
    const remote = await this.zone2.verifyRoleExpiry(roleId, nowMs);
    return remote.valid && !remote.expired;
  }

  enforceExpiry(roleId: string, nowMs = Date.now()): boolean {
    const rec = this.roles.get(roleId);
    if (!rec) {
      return false;
    }
    if (rec.expiresAtMs === null) {
      return true;
    }
    return nowMs < rec.expiresAtMs;
  }

  listActiveMembers(workspaceId: string, nowMs = Date.now()): readonly MemberRoleRecord[] {
    return [...this.roles.values()].filter(
      (r) => r.workspaceId === workspaceId && this.enforceExpiry(r.id, nowMs),
    );
  }
}

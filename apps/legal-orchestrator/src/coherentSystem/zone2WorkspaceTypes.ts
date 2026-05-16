/** Sprint 45+ — Zone 2 workspace contract (stubbed). */

export interface Zone2WorkspaceOwnershipValidation {
  readonly valid: boolean;
  readonly reason: string;
}

export interface Zone2RoleExpiryCheck {
  readonly valid: boolean;
  readonly expired: boolean;
}

export interface Zone2AuditEventResult {
  readonly accepted: boolean;
  readonly eventId: string;
}

export interface Zone2PermissionResolution {
  readonly allowed: boolean;
}

export interface Zone2IsolationValidation {
  readonly isolated: boolean;
  readonly reason: string;
}

export interface Zone2SettingValidation {
  readonly valid: boolean;
  readonly normalized: string;
}

export interface Zone2WorkspaceService {
  validateWorkspaceOwnership(userId: string, workspaceId: string): Promise<Zone2WorkspaceOwnershipValidation>;
  verifyRoleExpiry(roleId: string, currentTimeMs: number): Promise<Zone2RoleExpiryCheck>;
  sendAuditEventToRemote(
    action: string,
    resourceType: string,
    resourceId: string,
    changes: Readonly<Record<string, unknown>>,
  ): Promise<Zone2AuditEventResult>;
  resolvePermissionRemote(role: string, permission: string): Promise<Zone2PermissionResolution>;
  validateIsolationPolicy(workspace1Id: string, workspace2Id: string): Promise<Zone2IsolationValidation>;
  validateSettingValue(key: string, value: string): Promise<Zone2SettingValidation>;
}

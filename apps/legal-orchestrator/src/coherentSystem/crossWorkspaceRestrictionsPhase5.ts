import type { Zone2WorkspaceService } from "./zone2WorkspaceTypes.js";

export type IsolationPolicyType = "data_isolation" | "user_isolation" | "audit_isolation";

export interface IsolationPolicyRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly policyType: IsolationPolicyType;
  readonly enabled: boolean;
  readonly enforcedAtMs: number;
}

/**
 * Sprint 49 — Cross-workspace isolation enforcement.
 */
export class CrossWorkspaceRestrictionsPhase5Band {
  private readonly policies = new Map<string, IsolationPolicyRecord[]>();
  private readonly membersByWorkspace = new Map<string, Set<string>>();

  constructor(private readonly zone2: Zone2WorkspaceService) {}

  registerMember(workspaceId: string, userId: string): void {
    const set = this.membersByWorkspace.get(workspaceId) ?? new Set<string>();
    set.add(userId);
    this.membersByWorkspace.set(workspaceId, set);
  }

  enablePolicy(workspaceId: string, policyType: IsolationPolicyType): IsolationPolicyRecord {
    const rec: IsolationPolicyRecord = {
      id: `${workspaceId}:${policyType}`,
      workspaceId,
      policyType,
      enabled: true,
      enforcedAtMs: Date.now(),
    };
    const list = this.policies.get(workspaceId) ?? [];
    list.push(rec);
    this.policies.set(workspaceId, list);
    return rec;
  }

  async enforceDataIsolation<T extends { readonly workspaceId: string }>(
    workspaceId: string,
    rows: readonly T[],
  ): Promise<readonly T[]> {
    await this.zone2.validateIsolationPolicy(workspaceId, workspaceId);
    return rows.filter((r) => r.workspaceId === workspaceId);
  }

  enforceUserIsolation(viewerWorkspaceId: string, targetWorkspaceId: string): readonly string[] {
    if (viewerWorkspaceId !== targetWorkspaceId) {
      return [];
    }
    return [...(this.membersByWorkspace.get(viewerWorkspaceId) ?? [])];
  }

  validateCrossWorkspaceQuery(workspaceIds: readonly string[]): void {
    const unique = new Set(workspaceIds);
    if (unique.size > 1) {
      throw new Error("cannot query multiple workspaces simultaneously");
    }
  }

  async blockCrossWorkspaceAccess(workspace1Id: string, workspace2Id: string): Promise<boolean> {
    if (workspace1Id === workspace2Id) {
      return false;
    }
    const v = await this.zone2.validateIsolationPolicy(workspace1Id, workspace2Id);
    return v.isolated;
  }

  checkIsolationCompliance(workspaceId: string): boolean {
    const required: IsolationPolicyType[] = ["data_isolation", "user_isolation", "audit_isolation"];
    const enabled = new Set((this.policies.get(workspaceId) ?? []).filter((p) => p.enabled).map((p) => p.policyType));
    return required.every((t) => enabled.has(t));
  }
}

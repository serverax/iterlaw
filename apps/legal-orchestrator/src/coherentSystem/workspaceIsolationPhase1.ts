import { randomUUID } from "node:crypto";
import type { Zone2WorkspaceService } from "./zone2WorkspaceTypes.js";

export interface WorkspaceRecord {
  readonly id: string;
  readonly name: string;
  readonly ownerUserId: string;
  readonly createdAtMs: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Sprint 45 — Multi-tenant workspace foundation (in-memory registry).
 */
export class WorkspaceIsolationPhase1Band {
  private readonly workspaces = new Map<string, WorkspaceRecord>();

  constructor(private readonly zone2: Zone2WorkspaceService) {}

  async createWorkspace(
    ownerUserId: string,
    name: string,
    metadata: Readonly<Record<string, unknown>> = {},
  ): Promise<WorkspaceRecord> {
    const id = randomUUID();
    const record: WorkspaceRecord = {
      id,
      name: name.trim(),
      ownerUserId,
      createdAtMs: Date.now(),
      metadata: Object.freeze({ ...metadata }),
    };
    this.workspaces.set(id, record);
    return record;
  }

  fetchWorkspaceById(workspaceId: string): WorkspaceRecord | null {
    return this.workspaces.get(workspaceId) ?? null;
  }

  listUserWorkspaces(userId: string): readonly WorkspaceRecord[] {
    return [...this.workspaces.values()].filter((w) => w.ownerUserId === userId);
  }

  async validateWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
    const ws = this.fetchWorkspaceById(workspaceId);
    if (!ws) {
      return false;
    }
    if (ws.ownerUserId === userId) {
      return true;
    }
    const remote = await this.zone2.validateWorkspaceOwnership(userId, workspaceId);
    return remote.valid;
  }

  updateMetadata(workspaceId: string, metadata: Readonly<Record<string, unknown>>): WorkspaceRecord | null {
    const ws = this.fetchWorkspaceById(workspaceId);
    if (!ws) {
      return null;
    }
    const next: WorkspaceRecord = {
      ...ws,
      metadata: Object.freeze({ ...ws.metadata, ...metadata }),
    };
    this.workspaces.set(workspaceId, next);
    return next;
  }
}

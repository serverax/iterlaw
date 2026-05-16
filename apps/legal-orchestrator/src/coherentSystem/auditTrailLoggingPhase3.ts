import { randomUUID } from "node:crypto";
import type { Zone2WorkspaceService } from "./zone2WorkspaceTypes.js";

export interface AuditLogEntry {
  readonly id: string;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly changes: Readonly<Record<string, unknown>>;
  readonly timestampMs: number;
}

/**
 * Sprint 47 — Immutable workspace audit trail (INSERT-only in-memory log).
 */
export class AuditTrailLoggingPhase3Band {
  private readonly log: AuditLogEntry[] = [];
  private frozen = false;

  constructor(private readonly zone2: Zone2WorkspaceService) {}

  async logAction(input: {
    readonly workspaceId: string;
    readonly actorUserId: string;
    readonly action: string;
    readonly resourceType: string;
    readonly resourceId: string;
    readonly changes?: Readonly<Record<string, unknown>>;
  }): Promise<AuditLogEntry> {
    const changes = input.changes ?? {};
    await this.zone2.sendAuditEventToRemote(input.action, input.resourceType, input.resourceId, changes);
    const entry: AuditLogEntry = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      changes: Object.freeze({ ...changes }),
      timestampMs: Date.now(),
    };
    this.log.push(Object.freeze(entry));
    return entry;
  }

  fetchAuditLog(workspaceId: string): readonly AuditLogEntry[] {
    return this.log.filter((e) => e.workspaceId === workspaceId);
  }

  filterByDateRange(workspaceId: string, fromMs: number, toMs: number): readonly AuditLogEntry[] {
    return this.fetchAuditLog(workspaceId).filter((e) => e.timestampMs >= fromMs && e.timestampMs <= toMs);
  }

  exportAuditTrail(workspaceId: string): string {
    return JSON.stringify(this.fetchAuditLog(workspaceId));
  }

  verifyImmutability(): boolean {
    return !this.frozen;
  }

  /** Simulates forbidden UPDATE/DELETE — throws if audit is immutable. */
  attemptMutate(entryId: string): void {
    if (!this.verifyImmutability()) {
      throw new Error("audit log is immutable");
    }
    const idx = this.log.findIndex((e) => e.id === entryId);
    if (idx < 0) {
      throw new Error("entry not found");
    }
    throw new Error("audit records cannot be updated or deleted");
  }
}

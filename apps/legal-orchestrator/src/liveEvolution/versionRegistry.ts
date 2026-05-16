import { createHash } from "node:crypto";

export interface VersionRecord {
  resourceKey: string;
  version: number;
  contentHash: string;
  content: string;
  createdBy: string;
  approvedAt: string | null;
  createdAt: string;
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Append-only version chain with optional rollback pointer (active version).
 */
export class VersionRegistry {
  private readonly rows: VersionRecord[] = [];
  private readonly activeVersion = new Map<string, number>();

  reset(): void {
    this.rows.length = 0;
    this.activeVersion.clear();
  }

  append(resourceKey: string, content: string, createdBy: string): VersionRecord {
    const next = (this.latestVersion(resourceKey) ?? 0) + 1;
    const rec: VersionRecord = {
      resourceKey,
      version: next,
      contentHash: sha256(content),
      content,
      createdBy,
      approvedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.rows.push(rec);
    this.activeVersion.set(resourceKey, next);
    return rec;
  }

  listVersions(resourceKey: string): VersionRecord[] {
    return this.rows.filter((r) => r.resourceKey === resourceKey).sort((a, b) => a.version - b.version);
  }

  get(resourceKey: string, version: number): VersionRecord | undefined {
    return this.rows.find((r) => r.resourceKey === resourceKey && r.version === version);
  }

  latestVersion(resourceKey: string): number | undefined {
    const list = this.listVersions(resourceKey);
    if (list.length === 0) {
      return undefined;
    }
    return list[list.length - 1]?.version;
  }

  active(resourceKey: string): VersionRecord | undefined {
    const v = this.activeVersion.get(resourceKey);
    if (v === undefined) {
      return undefined;
    }
    return this.get(resourceKey, v);
  }

  rollbackTo(resourceKey: string, version: number): VersionRecord | undefined {
    const row = this.get(resourceKey, version);
    if (!row) {
      return undefined;
    }
    this.activeVersion.set(resourceKey, version);
    return row;
  }

  diff(resourceKey: string, vA: number, vB: number): { left: string; right: string; same: boolean } {
    const left = this.get(resourceKey, vA)?.content ?? "";
    const right = this.get(resourceKey, vB)?.content ?? "";
    return { left, right, same: left === right };
  }

  approve(resourceKey: string, version: number, at: string = new Date().toISOString()): boolean {
    const row = this.rows.find((r) => r.resourceKey === resourceKey && r.version === version);
    if (!row) {
      return false;
    }
    row.approvedAt = at;
    return true;
  }
}

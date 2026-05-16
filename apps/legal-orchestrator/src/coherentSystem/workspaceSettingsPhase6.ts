import type { Zone2WorkspaceService } from "./zone2WorkspaceTypes.js";

export type WorkspaceSettingKey = "timezone" | "language" | "case_template" | "default_role" | "retention_days";

export interface WorkspaceConfig {
  readonly timezone: string;
  readonly language: string;
  readonly caseTemplate: string;
  readonly defaultRole: string;
  readonly retentionDays: number;
}

const DEFAULTS: WorkspaceConfig = {
  timezone: "UTC",
  language: "en",
  caseTemplate: "default",
  defaultRole: "viewer",
  retentionDays: 365,
};

/**
 * Sprint 50 — Workspace settings and defaults.
 */
export class WorkspaceSettingsPhase6Band {
  private readonly settings = new Map<string, Map<string, string>>();

  constructor(private readonly zone2: Zone2WorkspaceService) {}

  private store(workspaceId: string): Map<string, string> {
    const existing = this.settings.get(workspaceId);
    if (existing) {
      return existing;
    }
    const map = new Map<string, string>();
    this.settings.set(workspaceId, map);
    return map;
  }

  async setSetting(workspaceId: string, key: WorkspaceSettingKey, value: string): Promise<string> {
    const v = await this.validateSettingValue(key, value);
    if (!v.valid) {
      throw new Error(`invalid setting: ${key}`);
    }
    this.store(workspaceId).set(key, v.normalized);
    return v.normalized;
  }

  getSetting(workspaceId: string, key: WorkspaceSettingKey): string {
    const stored = this.store(workspaceId).get(key);
    if (stored !== undefined) {
      return stored;
    }
    const def = DEFAULTS[this.configKey(key)];
    return typeof def === "number" ? String(def) : def;
  }

  applyDefaults(workspaceId: string): WorkspaceConfig {
    const cfg = this.getWorkspaceConfig(workspaceId);
    for (const [k, v] of Object.entries({
      timezone: cfg.timezone,
      language: cfg.language,
      case_template: cfg.caseTemplate,
      default_role: cfg.defaultRole,
      retention_days: String(cfg.retentionDays),
    })) {
      if (!this.store(workspaceId).has(k)) {
        this.store(workspaceId).set(k, v);
      }
    }
    return this.getWorkspaceConfig(workspaceId);
  }

  async validateSettingValue(key: WorkspaceSettingKey, value: string) {
    return this.zone2.validateSettingValue(key, value);
  }

  getWorkspaceConfig(workspaceId: string): WorkspaceConfig {
    return {
      timezone: this.getSetting(workspaceId, "timezone"),
      language: this.getSetting(workspaceId, "language"),
      caseTemplate: this.getSetting(workspaceId, "case_template"),
      defaultRole: this.getSetting(workspaceId, "default_role"),
      retentionDays: Number.parseInt(this.getSetting(workspaceId, "retention_days"), 10),
    };
  }

  applyTimezone(timestampMs: number, workspaceId: string): number {
    const tz = this.getSetting(workspaceId, "timezone");
    if (tz === "UTC") {
      return timestampMs;
    }
    return timestampMs;
  }

  enforceRetention<T extends { readonly createdAtMs: number }>(
    workspaceId: string,
    rows: readonly T[],
    nowMs = Date.now(),
  ): readonly T[] {
    const days = Number.parseInt(this.getSetting(workspaceId, "retention_days"), 10);
    const cutoff = nowMs - days * 86_400_000;
    return rows.filter((r) => r.createdAtMs >= cutoff);
  }

  private configKey(key: WorkspaceSettingKey): keyof WorkspaceConfig {
    switch (key) {
      case "timezone":
        return "timezone";
      case "language":
        return "language";
      case "case_template":
        return "caseTemplate";
      case "default_role":
        return "defaultRole";
      case "retention_days":
        return "retentionDays";
    }
  }
}

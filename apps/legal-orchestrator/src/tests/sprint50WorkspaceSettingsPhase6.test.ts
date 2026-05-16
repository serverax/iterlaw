import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WorkspaceSettingsPhase6Band } from "../coherentSystem/workspaceSettingsPhase6.js";
import { Zone2WorkspaceServiceStub } from "../coherentSystem/zone2WorkspaceStub.js";
import { delegatingZone2Workspace } from "./helpers/zone2WorkspaceTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql146 = readFileSync(join(__dirname, "../../db/migrations/146_sprint50_workspace_settings_phase6.sql"), "utf8");
const WS = "00000000-0000-4000-8000-0000000000a1";

describe("migration 146", () => {
  it("workspace_settings", () => expect(sql146).toMatch(/workspace_settings/i));
  it("columns", () => {
    expect(sql146).toMatch(/setting_key/i);
    expect(sql146).toMatch(/setting_value/i);
    expect(sql146).toMatch(/updated_at/i);
  });
  it("indexes", () => {
    expect(sql146).toMatch(/idx_workspace_settings_ws/i);
    expect(sql146).toMatch(/idx_workspace_settings_key/i);
  });
  it("workspace RLS", () => {
    expect(sql146).toMatch(/workspace_settings_ws_select/i);
    expect(sql146).toMatch(/workspace_settings_ws_write/i);
  });
});

describe("Sprint 50 — setSetting/getSetting", () => {
  it("timezone", async () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    await band.setSetting(WS, "timezone", "Europe/London");
    expect(band.getSetting(WS, "timezone")).toBe("Europe/London");
  });
  it("rejects invalid timezone", async () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    await expect(band.setSetting(WS, "timezone", "not-a-tz")).rejects.toThrow(/invalid/i);
  });
});

describe("Sprint 50 — defaults", () => {
  it("applyDefaults", () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    const cfg = band.applyDefaults(WS);
    expect(cfg.timezone).toBe("UTC");
    expect(cfg.retentionDays).toBe(365);
  });
});

describe("Sprint 50 — language validation", () => {
  it("en-GB", async () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    await band.setSetting(WS, "language", "en-GB");
    expect(band.getSetting(WS, "language")).toBe("en-GB");
  });
});

describe("Sprint 50 — retention", () => {
  it("enforceRetention drops old", async () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    await band.setSetting(WS, "retention_days", "90");
    const now = Date.now();
    const rows = [
      { createdAtMs: now - 100 * 86_400_000 },
      { createdAtMs: now - 10 * 86_400_000 },
    ];
    expect(band.enforceRetention(WS, rows, now)).toHaveLength(1);
  });
});

describe("Sprint 50 — timezone application", () => {
  it("returns ms", () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    const t = 1_700_000_000_000;
    expect(band.applyTimezone(t, WS)).toBe(t);
  });
});

describe("Sprint 50 — getWorkspaceConfig", () => {
  it("merged", async () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    await band.setSetting(WS, "case_template", "employment-v2");
    const cfg = band.getWorkspaceConfig(WS);
    expect(cfg.caseTemplate).toBe("employment-v2");
    expect(cfg.language).toBe("en");
  });
});

describe("Sprint 50 — default_role", () => {
  it("viewer default valid", async () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    await band.setSetting(WS, "default_role", "reviewer");
    expect(band.getSetting(WS, "default_role")).toBe("reviewer");
  });
});

describe("Sprint 50 — remote spy", () => {
  it("validateSettingValue", async () => {
    const spy = vi.fn(async (k: string, v: string) => new Zone2WorkspaceServiceStub().validateSettingValue(k, v));
    const band = new WorkspaceSettingsPhase6Band(delegatingZone2Workspace({ validateSettingValue: spy }));
    await band.setSetting(WS, "language", "fr");
    expect(spy).toHaveBeenCalled();
  });
});

describe("Sprint 50 — index export", () => {
  it("workspaceSettingsPhase6Band", async () => {
    const idx = await import("../coherentSystem/index.js");
    expect(idx.workspaceSettingsPhase6Band).toBeDefined();
  });
});

describe("Sprint 50 — retention invalid low", () => {
  it("rejects", async () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    await expect(band.setSetting(WS, "retention_days", "10")).rejects.toThrow();
  });
});

describe("Sprint 50 — primary key", () => {
  it("sql", () => expect(sql146).toMatch(/PRIMARY KEY \(workspace_id, setting_key\)/i));
});

describe("Sprint 50 — down migration", () => {
  it("drops policies", () => {
    const d = readFileSync(join(__dirname, "../../db/migrations/146_sprint50_workspace_settings_phase6.down.sql"), "utf8");
    expect(d).toMatch(/DROP POLICY/i);
  });
});

describe("Sprint 50 — ENABLE RLS", () => {
  it("sql", () => expect(sql146).toMatch(/ENABLE ROW LEVEL SECURITY/i));
});

describe("Sprint 50 — COMMENT", () => {
  it("present", () => expect(sql146).toMatch(/COMMENT ON TABLE/i));
});

describe("Sprint 50 — updated_at default", () => {
  it("sql", () => expect(sql146).toMatch(/updated_at.*DEFAULT now\(\)/is));
});

describe("Sprint 50 — case_template empty rejected", () => {
  it("throws", async () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    await expect(band.setSetting(WS, "case_template", "   ")).rejects.toThrow();
  });
});

describe("Sprint 50 — stub retention normalize", () => {
  it("365", async () => {
    const z = new Zone2WorkspaceServiceStub();
    const r = await z.validateSettingValue("retention_days", "400");
    expect(r.valid).toBe(true);
    expect(r.normalized).toBe("400");
  });
});

describe("Sprint 50 — workspace scoped keys", () => {
  it("isolated", async () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    await band.setSetting(WS, "language", "de");
    const other = "00000000-0000-4000-8000-0000000000b2";
    expect(band.getSetting(other, "language")).toBe("en");
  });
});

describe("Sprint 50 — write policy", () => {
  it("sql", () => expect(sql146).toMatch(/workspace_settings_ws_write/i));
});

describe("Sprint 50 — invalid default_role", () => {
  it("throws", async () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    await expect(band.setSetting(WS, "default_role", "superuser")).rejects.toThrow();
  });
});

describe("Sprint 50 — retention max bound", () => {
  it("rejects high", async () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    await expect(band.setSetting(WS, "retention_days", "99999")).rejects.toThrow();
  });
});

describe("Sprint 50 — applyDefaults fills store", () => {
  it("persists", () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    band.applyDefaults(WS);
    expect(band.getSetting(WS, "timezone")).toBe("UTC");
  });
});

describe("Sprint 50 — validateSettingValue direct", () => {
  it("delegates", async () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    const r = await band.validateSettingValue("language", "es");
    expect(r.valid).toBe(true);
  });
});

describe("Sprint 50 — workspace_id PK part", () => {
  it("sql", () => expect(sql146).toMatch(/workspace_id\s+UUID NOT NULL/i));
});

describe("Sprint 50 — setting_value text", () => {
  it("sql", () => expect(sql146).toMatch(/setting_value\s+TEXT NOT NULL/i));
});

describe("Sprint 50 — retention 30 min bound", () => {
  it("accepts 30", async () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    await band.setSetting(WS, "retention_days", "30");
    expect(band.getSetting(WS, "retention_days")).toBe("30");
  });
});

describe("Sprint 50 — retention 3650 max", () => {
  it("accepts", async () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    await band.setSetting(WS, "retention_days", "3650");
    expect(band.getSetting(WS, "retention_days")).toBe("3650");
  });
});

describe("Sprint 50 — case_template trim", () => {
  it("normalized", async () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    await band.setSetting(WS, "case_template", "  tmpl  ");
    expect(band.getSetting(WS, "case_template")).toBe("tmpl");
  });
});

describe("Sprint 50 — config retention number", () => {
  it("parsed", async () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    await band.setSetting(WS, "retention_days", "180");
    expect(band.getWorkspaceConfig(WS).retentionDays).toBe(180);
  });
});

describe("Sprint 50 — enforceRetention keeps all fresh", () => {
  it("none removed", async () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    const now = Date.now();
    const rows = [{ createdAtMs: now }, { createdAtMs: now - 1000 }];
    expect(band.enforceRetention(WS, rows, now)).toHaveLength(2);
  });
});

describe("Sprint 50 — stub invalid language", () => {
  it("normalized en", async () => {
    const z = new Zone2WorkspaceServiceStub();
    const r = await z.validateSettingValue("language", "bad!");
    expect(r.valid).toBe(false);
    expect(r.normalized).toBe("en");
  });
});

describe("Sprint 50 — overwrite setting", () => {
  it("latest wins", async () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    await band.setSetting(WS, "language", "fr");
    await band.setSetting(WS, "language", "de");
    expect(band.getSetting(WS, "language")).toBe("de");
  });
});

describe("Sprint 50 — default_role viewer", () => {
  it("from defaults", () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    expect(band.applyDefaults(WS).defaultRole).toBe("viewer");
  });
});

describe("Sprint 50 — can_write_workspace write policy", () => {
  it("sql", () => expect(sql146).toMatch(/current_user_can_write_workspace/i));
});

describe("Sprint 50 — timezone UTC default get", () => {
  it("value", () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    expect(band.getSetting(WS, "timezone")).toBe("UTC");
  });
});

describe("Sprint 50 — America/New_York", () => {
  it("valid", async () => {
    const band = new WorkspaceSettingsPhase6Band(new Zone2WorkspaceServiceStub());
    await band.setSetting(WS, "timezone", "America/New_York");
    expect(band.getSetting(WS, "timezone")).toBe("America/New_York");
  });
});

describe("Sprint 50 — references workspaces", () => {
  it("fk", () => expect(sql146).toMatch(/REFERENCES public\.workspaces/i));
});

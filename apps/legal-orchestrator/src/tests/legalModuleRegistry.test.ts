// Sprint 18 — Law Module Registry tests.

import { describe, it, expect } from "vitest";
import {
  PLANNED_LAW_MODULES,
  UK_EMPLOYMENT_MODULE,
  legalModuleRegistry,
} from "../lawModuleEngine";

describe("legalModuleRegistry", () => {
  it("declares UK Employment as the only active module", () => {
    const active = legalModuleRegistry.listActiveModules();
    expect(active).toHaveLength(1);
    expect(active[0]!.moduleId).toBe("uk_employment");
    expect(active[0]!.status).toBe("active");
  });

  it("registers every planned UK module as planned (not active)", () => {
    expect(PLANNED_LAW_MODULES.length).toBeGreaterThan(0);
    for (const m of PLANNED_LAW_MODULES) {
      expect(m.status).toBe("planned");
    }
    const all = legalModuleRegistry.listModules();
    expect(all.length).toBe(PLANNED_LAW_MODULES.length + 1);
  });

  it("never marks housing / immigration / benefits / debt / consumer / family / business / tax as active", () => {
    const forbidden = [
      "uk_housing",
      "uk_immigration",
      "uk_benefits",
      "uk_debt",
      "uk_consumer",
      "uk_family",
      "uk_business_contract",
      "uk_tax",
    ];
    for (const id of forbidden) {
      const m = legalModuleRegistry.findById(id);
      expect(m, `${id} must be registered`).toBeDefined();
      expect(m!.status, `${id} must be planned, not active`).toBe("planned");
    }
  });

  it("requireActiveModule rejects every non-active module", () => {
    for (const planned of PLANNED_LAW_MODULES) {
      const r = legalModuleRegistry.requireActiveModule({ moduleId: planned.moduleId });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.kind).toBe("inactive_module");
      }
    }
  });

  it("requireActiveModule accepts UK Employment", () => {
    const r = legalModuleRegistry.requireActiveModule({ moduleId: "uk_employment" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.module.moduleId).toBe("uk_employment");
      expect(r.module.status).toBe("active");
    }
  });

  it("every module enforces citationRequired = true and zeroCitationAnswerBlocked = true", () => {
    for (const m of legalModuleRegistry.listModules()) {
      expect(m.citationPolicy.citationRequired).toBe(true);
      expect(m.citationPolicy.zeroCitationAnswerBlocked).toBe(true);
    }
  });

  it("every module declares at least one answer-granting source tier", () => {
    for (const m of legalModuleRegistry.listModules()) {
      expect(m.sourceTiers.length).toBeGreaterThan(0);
      const granters = m.sourceTiers.filter((t) => t.grantsAnswer);
      expect(granters.length, `${m.moduleId} must have at least one answer-granting tier`).toBeGreaterThan(0);
    }
  });

  it("every module declares a temporal policy that excludes superseded sources by default", () => {
    for (const m of legalModuleRegistry.listModules()) {
      expect(m.temporalPolicy.excludeSuperseded).toBe(true);
    }
  });

  it("lookupModule by moduleId returns unknown_module for a missing id", () => {
    const r = legalModuleRegistry.lookupModule({ moduleId: "nonexistent_module_xyz" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("unknown_module");
    }
  });

  it("lookupModule returns invalid_lookup_key for an empty moduleId", () => {
    const r = legalModuleRegistry.lookupModule({ moduleId: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("invalid_lookup_key");
    }
  });

  it("lookupModule by (jurisdiction, lawArea) finds UK_ENGLAND_WALES employment", () => {
    const r = legalModuleRegistry.lookupModule({
      jurisdiction: "UK_ENGLAND_WALES",
      lawArea: "employment",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.module.moduleId).toBe("uk_employment");
    }
  });

  it("UK_EMPLOYMENT_MODULE has the expected namespaces and tiers", () => {
    expect(UK_EMPLOYMENT_MODULE.ragNamespace).toBe("iterlaw:rag:uk_employment");
    expect(UK_EMPLOYMENT_MODULE.rulesNamespace).toBe("iterlaw:rules:uk_employment");
    expect(UK_EMPLOYMENT_MODULE.templatesNamespace).toBe("iterlaw:templates:uk_employment");
    expect(UK_EMPLOYMENT_MODULE.sourceTiers.map((t) => t.tier)).toEqual([1, 2, 3, 4, 5]);
  });
});

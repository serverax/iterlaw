// Sprint 18A — Feature-flagged Law Module Routing tests.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getLawModuleRoutingConfig } from "../config/featureFlags";
import { routeLegalRequestToModule } from "../lawModuleEngine/legalModuleRouting";

const FLAG = "ITERLAW_LAW_MODULE_ROUTING_ENABLED";

describe("Sprint 18A — law module routing feature flag", () => {
  const prev = process.env[FLAG];

  beforeEach(() => {
    delete process.env[FLAG];
  });

  afterEach(() => {
    if (prev === undefined) delete process.env[FLAG];
    else process.env[FLAG] = prev;
  });

  it("flag defaults to OFF when unset", () => {
    delete process.env[FLAG];
    expect(getLawModuleRoutingConfig().enabled).toBe(false);
  });

  it("flag is OFF for empty / 'false' / arbitrary text", () => {
    for (const v of ["", "false", "0", "no", "maybe"]) {
      process.env[FLAG] = v;
      expect(getLawModuleRoutingConfig().enabled).toBe(false);
    }
  });

  it("flag is ON only for explicit 'true' / '1' / 'yes' / 'on' (case-insensitive)", () => {
    for (const v of ["true", "TRUE", "1", "yes", "on"]) {
      process.env[FLAG] = v;
      expect(getLawModuleRoutingConfig().enabled).toBe(true);
    }
  });
});

describe("Sprint 18A — routeLegalRequestToModule", () => {
  it("defaults to UK Employment when no module is specified", () => {
    const decision = routeLegalRequestToModule({});
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.moduleId).toBe("uk_employment");
      expect(decision.ragNamespace).toBe("iterlaw:rag:uk_employment");
    }
  });

  it("accepts an explicit uk_employment moduleId", () => {
    const decision = routeLegalRequestToModule({ moduleId: "uk_employment" });
    expect(decision.ok).toBe(true);
    if (decision.ok) expect(decision.moduleId).toBe("uk_employment");
  });

  it("refuses planned modules with inactive_module error", () => {
    for (const planned of ["uk_housing", "uk_immigration", "uk_benefits", "uk_debt", "uk_consumer", "uk_family", "uk_business_contract", "uk_tax"]) {
      const decision = routeLegalRequestToModule({ moduleId: planned });
      expect(decision.ok).toBe(false);
      if (!decision.ok) expect(decision.error.kind).toBe("inactive_module");
    }
  });

  it("returns unknown_module for an unregistered moduleId", () => {
    const decision = routeLegalRequestToModule({ moduleId: "this_module_does_not_exist" });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.error.kind).toBe("unknown_module");
  });

  it("records citation_required and zero_citation_answer_blocked in the decision trace", () => {
    const decision = routeLegalRequestToModule({ moduleId: "uk_employment" });
    expect(decision.ok).toBe(true);
    expect(
      decision.decisionTrace.some((t) => t.includes("citation_required:true")),
    ).toBe(true);
    expect(
      decision.decisionTrace.some((t) => t.includes("zero_citation_answer_blocked:true")),
    ).toBe(true);
  });

  it("decision trace shows active module id when routed successfully", () => {
    const decision = routeLegalRequestToModule({});
    expect(decision.ok).toBe(true);
    expect(decision.decisionTrace).toContain("law_module_routing:active:uk_employment");
  });

  it("decision trace shows refusal kind when routed to a planned module", () => {
    const decision = routeLegalRequestToModule({ moduleId: "uk_housing" });
    expect(decision.ok).toBe(false);
    expect(decision.decisionTrace).toContain("law_module_routing:refused:inactive_module");
  });

  it("never calls an external service (pure function — no fetch/axios/http)", () => {
    // Statically asserted: this test imports only the registry types/function.
    // The function file is `legalModuleRouting.ts`; it has no network imports.
    const source = require("fs").readFileSync(
      require("path").join(__dirname, "..", "lawModuleEngine", "legalModuleRouting.ts"),
      "utf8",
    ) as string;
    expect(source).not.toMatch(/from\s+"axios"/);
    expect(source).not.toMatch(/from\s+'axios'/);
    expect(source).not.toMatch(/from\s+"node-fetch"/);
    expect(source).not.toMatch(/import\s+["']http/);
    expect(source).not.toMatch(/import\s+["']https/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com/);
  });
});

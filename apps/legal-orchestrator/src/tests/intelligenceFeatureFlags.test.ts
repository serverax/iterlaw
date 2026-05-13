// Sprint 15 — feature flag config tests.

import { afterEach, describe, expect, it, vi } from "vitest";
import { getIntelligenceLayerConfig } from "../config/featureFlags";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Sprint 15 — intelligence layer feature flags", () => {
  it("Test 1: missing env disables intelligence", () => {
    vi.stubEnv("ITERLAW_INTELLIGENCE_LAYER_ENABLED", "");
    vi.stubEnv("ITERLAW_INTELLIGENCE_LAYER_MODE", "");
    const c = getIntelligenceLayerConfig();
    expect(c.enabled).toBe(false);
    expect(c.mode).toBe("off");
  });

  it("Test 2: explicit false disables intelligence", () => {
    vi.stubEnv("ITERLAW_INTELLIGENCE_LAYER_ENABLED", "false");
    vi.stubEnv("ITERLAW_INTELLIGENCE_LAYER_MODE", "shadow");
    const c = getIntelligenceLayerConfig();
    expect(c.enabled).toBe(false);
    expect(c.mode).toBe("off");
  });

  it("Test 3: enabled=true with missing mode stays off (safest default)", () => {
    vi.stubEnv("ITERLAW_INTELLIGENCE_LAYER_ENABLED", "true");
    vi.stubEnv("ITERLAW_INTELLIGENCE_LAYER_MODE", "");
    const c = getIntelligenceLayerConfig();
    expect(c.enabled).toBe(true);
    expect(c.mode).toBe("off");
  });

  it("Test 4: enabled=true + mode=shadow enables shadow", () => {
    vi.stubEnv("ITERLAW_INTELLIGENCE_LAYER_ENABLED", "true");
    vi.stubEnv("ITERLAW_INTELLIGENCE_LAYER_MODE", "shadow");
    const c = getIntelligenceLayerConfig();
    expect(c.enabled).toBe(true);
    expect(c.mode).toBe("shadow");
  });

  it("Test 5: enabled=true + mode=active enables active", () => {
    vi.stubEnv("ITERLAW_INTELLIGENCE_LAYER_ENABLED", "true");
    vi.stubEnv("ITERLAW_INTELLIGENCE_LAYER_MODE", "active");
    const c = getIntelligenceLayerConfig();
    expect(c.enabled).toBe(true);
    expect(c.mode).toBe("active");
  });

  it("Test 6: invalid mode falls back to off even with enabled=true", () => {
    vi.stubEnv("ITERLAW_INTELLIGENCE_LAYER_ENABLED", "true");
    vi.stubEnv("ITERLAW_INTELLIGENCE_LAYER_MODE", "lol_invalid");
    const c = getIntelligenceLayerConfig();
    expect(c.enabled).toBe(true);
    expect(c.mode).toBe("off");
  });

  it("Test 7: config output contains no secret-like value", () => {
    vi.stubEnv("ITERLAW_INTELLIGENCE_LAYER_ENABLED", "true");
    vi.stubEnv("ITERLAW_INTELLIGENCE_LAYER_MODE", "shadow");
    vi.stubEnv("DATABASE_URL", "postgres://SECRET_user:SECRET_pw@SECRET_host/db");
    vi.stubEnv("POSTGRES_PASSWORD", "SECRET_pw_value");
    const c = getIntelligenceLayerConfig();
    const body = JSON.stringify(c);
    expect(body).not.toContain("SECRET_user");
    expect(body).not.toContain("SECRET_pw");
    expect(body).not.toContain("SECRET_host");
    expect(body).not.toContain("postgres://");
    expect(body).not.toContain("POSTGRES_PASSWORD");
  });

  it("Test 8: config function does not read DATABASE_URL", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("ITERLAW_INTELLIGENCE_LAYER_ENABLED", "true");
    vi.stubEnv("ITERLAW_INTELLIGENCE_LAYER_MODE", "shadow");
    const c = getIntelligenceLayerConfig();
    expect(c.enabled).toBe(true);
    expect(c.mode).toBe("shadow");
    // Even with DATABASE_URL empty, config still works — proves it
    // does not depend on it.
  });

  it("Test 9: config function does not require any DB env", () => {
    // Strip every common DB env var; config must still return cleanly.
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("POSTGRES_PASSWORD", "");
    vi.stubEnv("PGPASSWORD", "");
    const c = getIntelligenceLayerConfig();
    expect(c).toMatchObject({ enabled: false, mode: "off", source: "env" });
  });

  it("Test 10: config function does not require external LLM env", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    const c = getIntelligenceLayerConfig();
    expect(c).toMatchObject({ enabled: false, mode: "off", source: "env" });
  });
});

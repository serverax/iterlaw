import { describe, it, expect, beforeEach } from "vitest";
import { PromptRegistry, RuleRegistry, ABTestFramework } from "../liveEvolution/index.js";

describe("Sprint 19 — PromptRegistry", () => {
  let reg: PromptRegistry;

  beforeEach(() => {
    reg = new PromptRegistry();
  });

  it("appends v1 then v2 then v3 for same key", () => {
    reg.append("p.system", "a", "u1");
    reg.append("p.system", "b", "u1");
    reg.append("p.system", "c", "u2");
    const vs = reg.listVersions("p.system");
    expect(vs.map((r) => r.version)).toEqual([1, 2, 3]);
    expect(vs.map((r) => r.content)).toEqual(["a", "b", "c"]);
  });

  it("active points at latest after each append", () => {
    reg.append("k", "x", "a");
    expect(reg.active("k")?.version).toBe(1);
    reg.append("k", "y", "a");
    expect(reg.active("k")?.version).toBe(2);
  });

  it("get returns undefined for unknown key or version", () => {
    reg.append("k", "x", "a");
    expect(reg.get("missing", 1)).toBeUndefined();
    expect(reg.get("k", 99)).toBeUndefined();
  });

  it("rollbackTo switches active to prior version", () => {
    reg.append("k", "v1", "a");
    reg.append("k", "v2", "a");
    reg.append("k", "v3", "a");
    const rolled = reg.rollbackTo("k", 2);
    expect(rolled?.content).toBe("v2");
    expect(reg.active("k")?.version).toBe(2);
  });

  it("rollbackTo returns undefined when version missing", () => {
    reg.append("k", "v1", "a");
    expect(reg.rollbackTo("k", 5)).toBeUndefined();
    expect(reg.active("k")?.version).toBe(1);
  });

  it("diff reports same when contents match", () => {
    reg.append("k", "same", "a");
    reg.append("k", "same", "b");
    const d = reg.diff("k", 1, 2);
    expect(d.same).toBe(true);
    expect(d.left).toBe("same");
    expect(d.right).toBe("same");
  });

  it("diff reports different contents", () => {
    reg.append("k", "a", "u");
    reg.append("k", "b", "u");
    expect(reg.diff("k", 1, 2).same).toBe(false);
  });

  it("approve sets approvedAt on matching row", () => {
    reg.append("k", "c", "u");
    expect(reg.get("k", 1)?.approvedAt).toBeNull();
    expect(reg.approve("k", 1, "2020-01-01T00:00:00.000Z")).toBe(true);
    expect(reg.get("k", 1)?.approvedAt).toBe("2020-01-01T00:00:00.000Z");
  });

  it("approve returns false for missing version", () => {
    reg.append("k", "c", "u");
    expect(reg.approve("k", 9)).toBe(false);
  });

  it("contentHash changes when content changes", () => {
    const r1 = reg.append("k", "hello", "u");
    const r2 = reg.append("k", "world", "u");
    expect(r1.contentHash).not.toBe(r2.contentHash);
    expect(r1.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("reset clears all state", () => {
    reg.append("k", "x", "u");
    reg.reset();
    expect(reg.listVersions("k")).toEqual([]);
    expect(reg.active("k")).toBeUndefined();
  });

  it("versions for different keys are isolated", () => {
    reg.append("a", "1", "u");
    reg.append("b", "2", "u");
    expect(reg.listVersions("a")).toHaveLength(1);
    expect(reg.listVersions("b")).toHaveLength(1);
  });

  it("latestVersion tracks highest appended", () => {
    expect(reg.latestVersion("k")).toBeUndefined();
    reg.append("k", "a", "u");
    expect(reg.latestVersion("k")).toBe(1);
    reg.append("k", "b", "u");
    expect(reg.latestVersion("k")).toBe(2);
  });

  it("preserves createdBy on each version", () => {
    reg.append("k", "a", "alice");
    reg.append("k", "b", "bob");
    expect(reg.get("k", 1)?.createdBy).toBe("alice");
    expect(reg.get("k", 2)?.createdBy).toBe("bob");
  });

  it("after rollback, append increments from max version", () => {
    reg.append("k", "v1", "u");
    reg.append("k", "v2", "u");
    reg.append("k", "v3", "u");
    reg.rollbackTo("k", 2);
    reg.append("k", "v4", "u");
    expect(reg.latestVersion("k")).toBe(4);
    expect(reg.get("k", 4)?.content).toBe("v4");
    expect(reg.active("k")?.version).toBe(4);
  });

  it("inactive older version row remains readable after rollback", () => {
    reg.append("k", "old", "u");
    reg.append("k", "new", "u");
    reg.rollbackTo("k", 1);
    expect(reg.get("k", 2)?.content).toBe("new");
    expect(reg.active("k")?.content).toBe("old");
  });
});

describe("Sprint 19 — RuleRegistry", () => {
  let reg: RuleRegistry;

  beforeEach(() => {
    reg = new RuleRegistry();
  });

  it("appends sequential rule versions", () => {
    reg.append("rule.pack", '{"x":1}', "admin");
    reg.append("rule.pack", '{"x":2}', "admin");
    expect(reg.listVersions("rule.pack").map((r) => r.version)).toEqual([1, 2]);
  });

  it("rollback after append restores readable JSON", () => {
    reg.append("r", '{"a":true}', "u");
    reg.append("r", '{"a":false}', "u");
    reg.rollbackTo("r", 1);
    expect(reg.active("r")?.content).toBe('{"a":true}');
  });

  it("diff compares rule payloads", () => {
    reg.append("r", "A", "u");
    reg.append("r", "B", "u");
    expect(reg.diff("r", 1, 2).same).toBe(false);
  });

  it("approve on rule row", () => {
    reg.append("r", "{}", "u");
    expect(reg.approve("r", 1)).toBe(true);
    expect(reg.get("r", 1)?.approvedAt).not.toBeNull();
  });

  it("reset clears rules", () => {
    reg.append("r", "{}", "u");
    reg.reset();
    expect(reg.active("r")).toBeUndefined();
  });

  it("isolates versions per rule_key", () => {
    reg.append("r1", "A", "u");
    reg.append("r2", "B", "u");
    expect(reg.listVersions("r1")[0]?.version).toBe(1);
    expect(reg.listVersions("r2")[0]?.version).toBe(1);
  });
});

describe("Sprint 19 — ABTestFramework", () => {
  let ab: ABTestFramework;

  beforeEach(() => {
    ab = new ABTestFramework();
  });

  it("disabled flag is not enabled for any tier", () => {
    ab.setFlag("new_ui", false, {});
    expect(ab.isEnabled("new_ui", { tier: "PRO" })).toBe(false);
  });

  it("enabled flag with no segment applies to all tiers", () => {
    ab.setFlag("rollout", true, {});
    expect(ab.isEnabled("rollout", { tier: "FREE" })).toBe(true);
    expect(ab.isEnabled("rollout", { tier: "ENTERPRISE" })).toBe(true);
  });

  it("segment tiers excludes non-listed tier", () => {
    ab.setFlag("pro_only", true, { tiers: ["PRO", "ENTERPRISE"] });
    expect(ab.isEnabled("pro_only", { tier: "FREE" })).toBe(false);
    expect(ab.isEnabled("pro_only", { tier: "PRO" })).toBe(true);
  });

  it("empty tiers array behaves like unrestricted", () => {
    ab.setFlag("f", true, { tiers: [] });
    expect(ab.isEnabled("f", { tier: "FREE" })).toBe(true);
  });

  it("unknown flag name is disabled", () => {
    expect(ab.isEnabled("nope", { tier: "PRO" })).toBe(false);
  });

  it("recordMetric appends rows", () => {
    ab.recordMetric("t1", 1, 0.12, 0.03);
    ab.recordMetric("t1", 2, 0.2, 0.01);
    expect(ab.listMetrics("t1")).toHaveLength(2);
  });

  it("listMetrics without filter returns all", () => {
    ab.recordMetric("a", 1, 0, 0);
    ab.recordMetric("b", 1, 0, 0);
    expect(ab.listMetrics()).toHaveLength(2);
  });

  it("listMetrics filters by test_id", () => {
    ab.recordMetric("x", 1, 0.5, 0.1);
    ab.recordMetric("y", 1, 0.4, 0.2);
    expect(ab.listMetrics("x")).toHaveLength(1);
    expect(ab.listMetrics("x")[0]?.variantVersion).toBe(1);
  });

  it("reset clears flags and metrics", () => {
    ab.setFlag("f", true, {});
    ab.recordMetric("t", 1, 0, 0);
    ab.reset();
    expect(ab.isEnabled("f", { tier: "PRO" })).toBe(false);
    expect(ab.listMetrics()).toHaveLength(0);
  });

  it("re-setFlag replaces prior segment rules", () => {
    ab.setFlag("f", true, { tiers: ["PRO"] });
    expect(ab.isEnabled("f", { tier: "FREE" })).toBe(false);
    ab.setFlag("f", true, { tiers: ["FREE"] });
    expect(ab.isEnabled("f", { tier: "FREE" })).toBe(true);
  });

  it("single-tier segment only matches that tier", () => {
    ab.setFlag("ent", true, { tiers: ["ENTERPRISE"] });
    expect(ab.isEnabled("ent", { tier: "ENTERPRISE" })).toBe(true);
    expect(ab.isEnabled("ent", { tier: "PRO" })).toBe(false);
  });

  it("recordMetric stores variant_version including zero", () => {
    ab.recordMetric("baseline", 0, 0, 0);
    const m = ab.listMetrics("baseline")[0];
    expect(m?.variantVersion).toBe(0);
    expect(m?.conversionRate).toBe(0);
    expect(m?.errorRate).toBe(0);
  });

  it("recordMetric preserves fractional rates", () => {
    ab.recordMetric("t", 3, 0.333, 0.001);
    const m = ab.listMetrics("t")[0];
    expect(m?.conversionRate).toBeCloseTo(0.333, 3);
    expect(m?.errorRate).toBeCloseTo(0.001, 3);
  });
});

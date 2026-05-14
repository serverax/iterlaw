import { describe, expect, it } from "vitest";

import {
  InMemoryApprovedAnswerStore,
  buildApprovedAnswerKey,
} from "../retrieval/approvedAnswerStore";
import type {
  ApprovedAnswerEntry,
} from "../retrieval/approvedAnswerFastPath";

const NOW = "2026-05-14";

const BASE = {
  tenantId: "tenant-a",
  country: "UK_ENGLAND_WALES",
  moduleId: "uk_employment",
  question: "What is the qualifying service for unfair dismissal?",
  contextSourceHash: "ctx-v1",
  entitlementScope: "ent:active:uk_employment",
} as const;

function entry(o: Partial<ApprovedAnswerEntry> = {}): ApprovedAnswerEntry {
  return {
    cacheKey: "k",
    answerText: "An employee normally needs 2 years' continuous service.",
    citationCount: 2,
    qaStatus: "approved",
    lastVerifiedAt: "2026-04-01",
    expiresAt: "2027-01-01",
    ...o,
  };
}

describe("buildApprovedAnswerKey — key dimensions", () => {
  it("is deterministic for identical inputs", () => {
    const a = buildApprovedAnswerKey({ ...BASE });
    const b = buildApprovedAnswerKey({ ...BASE });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when the tenant changes (tenant isolation)", () => {
    const a = buildApprovedAnswerKey({ ...BASE });
    const b = buildApprovedAnswerKey({ ...BASE, tenantId: "tenant-b" });
    expect(a).not.toBe(b);
  });

  it("changes when the country changes (country isolation)", () => {
    const a = buildApprovedAnswerKey({ ...BASE });
    const b = buildApprovedAnswerKey({ ...BASE, country: "UK_SCOTLAND" });
    expect(a).not.toBe(b);
  });

  it("changes when the module changes (module isolation)", () => {
    const a = buildApprovedAnswerKey({ ...BASE });
    const b = buildApprovedAnswerKey({ ...BASE, moduleId: "uk_housing" });
    expect(a).not.toBe(b);
  });

  it("changes when the contextSourceHash changes (citation/source version)", () => {
    const a = buildApprovedAnswerKey({ ...BASE });
    const b = buildApprovedAnswerKey({ ...BASE, contextSourceHash: "ctx-v2" });
    expect(a).not.toBe(b);
  });

  it("changes when the entitlementScope changes (entitlement isolation)", () => {
    const a = buildApprovedAnswerKey({ ...BASE });
    const b = buildApprovedAnswerKey({ ...BASE, entitlementScope: "ent:inactive" });
    expect(a).not.toBe(b);
  });

  it("changes when the citationVersion changes", () => {
    const a = buildApprovedAnswerKey({ ...BASE });
    const b = buildApprovedAnswerKey({ ...BASE, citationVersion: "v2" });
    expect(a).not.toBe(b);
  });

  it("normalises whitespace / case / trailing punctuation in the question", () => {
    const a = buildApprovedAnswerKey({ ...BASE });
    const b = buildApprovedAnswerKey({
      ...BASE,
      question: "  What is the qualifying service for unfair dismissal? ",
    });
    expect(a).toBe(b);
  });
});

describe("InMemoryApprovedAnswerStore — write / read", () => {
  it("put then get returns the entry", () => {
    const store = new InMemoryApprovedAnswerStore({ nowIsoDate: NOW });
    const key = buildApprovedAnswerKey({ ...BASE });
    const put = store.put(key, entry({ cacheKey: key }));
    expect(put.ok).toBe(true);
    const got = store.get(key);
    expect(got?.cacheKey).toBe(key);
  });

  it("returns undefined on cache miss", () => {
    const store = new InMemoryApprovedAnswerStore({ nowIsoDate: NOW });
    expect(store.get("non-existent")).toBeUndefined();
  });
});

describe("InMemoryApprovedAnswerStore — refusal contract", () => {
  it("refuses to put an unapproved entry (failed)", () => {
    const store = new InMemoryApprovedAnswerStore({ nowIsoDate: NOW });
    const out = store.put("k", entry({ qaStatus: "failed" }));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("qa_status_not_approved");
  });

  it("refuses to put an unapproved entry (draft / unreviewed)", () => {
    const store = new InMemoryApprovedAnswerStore({ nowIsoDate: NOW });
    for (const s of ["draft", "unreviewed"] as const) {
      const out = store.put("k", entry({ qaStatus: s }));
      expect(out.ok).toBe(false);
    }
  });

  it("refuses to put a zero-citation entry (no uncited answer)", () => {
    const store = new InMemoryApprovedAnswerStore({ nowIsoDate: NOW });
    const out = store.put("k", entry({ citationCount: 0 }));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("no_citations");
  });

  it("refuses to put an expired-at-write entry", () => {
    const store = new InMemoryApprovedAnswerStore({ nowIsoDate: NOW });
    const out = store.put("k", entry({ expiresAt: "2020-01-01" }));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("expired_at_write_time");
  });

  it("refuses to put an entry with empty answer text", () => {
    const store = new InMemoryApprovedAnswerStore({ nowIsoDate: NOW });
    const out = store.put("k", entry({ answerText: "" }));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toBe("missing_answer_text");
  });
});

describe("InMemoryApprovedAnswerStore — isolation in practice", () => {
  it("two tenants with the same question get different keys → no cross-read", () => {
    const store = new InMemoryApprovedAnswerStore({ nowIsoDate: NOW });
    const keyA = buildApprovedAnswerKey({ ...BASE, tenantId: "tenant-a" });
    const keyB = buildApprovedAnswerKey({ ...BASE, tenantId: "tenant-b" });
    store.put(keyA, entry({ cacheKey: keyA, answerText: "A's answer" }));
    expect(store.get(keyB)).toBeUndefined();
    expect(store.get(keyA)?.answerText).toBe("A's answer");
  });

  it("two modules with the same question and tenant get different keys", () => {
    const store = new InMemoryApprovedAnswerStore({ nowIsoDate: NOW });
    const k1 = buildApprovedAnswerKey({ ...BASE, moduleId: "uk_employment" });
    const k2 = buildApprovedAnswerKey({ ...BASE, moduleId: "uk_housing" });
    store.put(k1, entry({ cacheKey: k1 }));
    expect(store.get(k2)).toBeUndefined();
  });

  it("two countries get different keys", () => {
    const store = new InMemoryApprovedAnswerStore({ nowIsoDate: NOW });
    const k1 = buildApprovedAnswerKey({ ...BASE, country: "UK_ENGLAND_WALES" });
    const k2 = buildApprovedAnswerKey({ ...BASE, country: "UK_SCOTLAND" });
    store.put(k1, entry({ cacheKey: k1 }));
    expect(store.get(k2)).toBeUndefined();
  });

  it("stale citation version → different key → cache miss (rejected)", () => {
    const store = new InMemoryApprovedAnswerStore({ nowIsoDate: NOW });
    const old = buildApprovedAnswerKey({ ...BASE, citationVersion: "v1" });
    const newer = buildApprovedAnswerKey({ ...BASE, citationVersion: "v2" });
    store.put(old, entry({ cacheKey: old }));
    expect(store.get(newer)).toBeUndefined();
  });

  it("entitlement mismatch → different key → cache miss (rejected)", () => {
    const store = new InMemoryApprovedAnswerStore({ nowIsoDate: NOW });
    const active = buildApprovedAnswerKey({ ...BASE, entitlementScope: "ent:active:uk_employment" });
    const expired = buildApprovedAnswerKey({ ...BASE, entitlementScope: "ent:expired:uk_employment" });
    store.put(active, entry({ cacheKey: active }));
    expect(store.get(expired)).toBeUndefined();
  });
});

describe("InMemoryApprovedAnswerStore — invalidation", () => {
  it("invalidate(predicate) removes matching entries and reports count", () => {
    const store = new InMemoryApprovedAnswerStore({ nowIsoDate: NOW });
    store.put("a", entry({ cacheKey: "a" }));
    store.put("b", entry({ cacheKey: "b" }));
    store.put("c", entry({ cacheKey: "c" }));
    const removed = store.invalidate((k) => k === "a" || k === "c");
    expect(removed).toBe(2);
    expect(store.size()).toBe(1);
    expect(store.get("a")).toBeUndefined();
    expect(store.get("b")).toBeDefined();
    expect(store.get("c")).toBeUndefined();
  });
});

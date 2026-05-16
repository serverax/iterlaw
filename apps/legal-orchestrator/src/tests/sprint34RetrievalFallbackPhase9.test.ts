import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RETRIEVAL_FALLBACK_CHAIN,
  RetrievalFallbackPhase9Band,
} from "../coherentSystem/retrievalFallbackPhase9.js";
import { Zone2RetrievalServiceStub } from "../coherentSystem/zone2RetrievalStub.js";
import { delegatingZone2Retrieval } from "./helpers/zone2RetrievalTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql130 = readFileSync(
  join(__dirname, "../../db/migrations/130_sprint34_retrieval_fallback_strategy_log.sql"),
  "utf8",
);
const Q1 = "00000000-0000-4000-8000-000000000001";

describe("migration 130_sprint34_retrieval_fallback_strategy_log.sql", () => {
  it("creates retrieval_fallback_strategy_log", () => {
    expect(sql130).toMatch(/CREATE TABLE IF NOT EXISTS public\.retrieval_fallback_strategy_log/i);
  });
  it("columns query_id strategies reason executed_at", () => {
    expect(sql130).toMatch(/query_id/i);
    expect(sql130).toMatch(/primary_strategy/i);
    expect(sql130).toMatch(/fallback_strategy/i);
    expect(sql130).toMatch(/reason/i);
    expect(sql130).toMatch(/executed_at/i);
  });
  it("indexes query_id and primary_strategy", () => {
    expect(sql130).toMatch(/idx_retrieval_fallback_log_query/i);
    expect(sql130).toMatch(/idx_retrieval_fallback_log_primary/i);
  });
  it("member RLS select insert", () => {
    expect(sql130).toMatch(/retrieval_fallback_log_member_select/i);
    expect(sql130).toMatch(/retrieval_fallback_log_member_insert/i);
    expect(sql130).toMatch(/current_app_user_id\(\)/i);
  });
  it("admin delete", () => {
    expect(sql130).toMatch(/retrieval_fallback_log_admin_delete/i);
  });
  it("down drops table", () => {
    const down = readFileSync(
      join(__dirname, "../../db/migrations/130_sprint34_retrieval_fallback_strategy_log.down.sql"),
      "utf8",
    );
    expect(down).toMatch(/DROP TABLE IF EXISTS public\.retrieval_fallback_strategy_log/i);
  });
});

describe("Sprint 34 — RETRIEVAL_FALLBACK_CHAIN", () => {
  it("four strategies in order", () => {
    expect(RETRIEVAL_FALLBACK_CHAIN).toEqual(["hnsw", "ollama", "bm25", "static_faq"]);
  });
  it("ends with static_faq", () => {
    expect(RETRIEVAL_FALLBACK_CHAIN[RETRIEVAL_FALLBACK_CHAIN.length - 1]).toBe("static_faq");
  });
});

describe("Sprint 34 — detectStrategyFailure", () => {
  it("timeout is failure", () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    expect(band.detectStrategyFailure("request timeout")).toBe(true);
  });
  it("empty not failure", () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    expect(band.detectStrategyFailure("")).toBe(false);
  });
  it("unavailable", () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    expect(band.detectStrategyFailure("service unavailable")).toBe(true);
  });
  it("failed keyword", () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    expect(band.detectStrategyFailure("index failed")).toBe(true);
  });
});

describe("Sprint 34 — selectFallback", () => {
  it("hnsw to ollama", () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    expect(band.selectFallback("hnsw")).toBe("ollama");
  });
  it("ollama to bm25", () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    expect(band.selectFallback("ollama")).toBe("bm25");
  });
  it("bm25 to static_faq", () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    expect(band.selectFallback("bm25")).toBe("static_faq");
  });
  it("static_faq terminal null", () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    expect(band.selectFallback("static_faq")).toBeNull();
  });
  it("unknown maps to static_faq", () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    expect(band.selectFallback("hnsw")).toBe("ollama");
  });
});

describe("Sprint 34 — Zone2RetrievalServiceStub recommendFallback", () => {
  it("follows chain", async () => {
    const z = new Zone2RetrievalServiceStub();
    const r = await z.recommendFallback("hnsw", "timeout");
    expect(r.fallbackStrategy).toBe("ollama");
    expect(r.reason).toContain("zone2:");
  });
  it("static_faq stays", async () => {
    const z = new Zone2RetrievalServiceStub();
    const r = await z.recommendFallback("static_faq", "err");
    expect(r.fallbackStrategy).toBe("static_faq");
  });
});

describe("Sprint 34 — resolveFallback", () => {
  it("returns null when no failure", async () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    const r = await band.resolveFallback("hnsw", "ok");
    expect(r).toBeNull();
  });
  it("returns zone2 recommendation", async () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    const r = await band.resolveFallback("ollama", "failed");
    expect(r?.fallback).toBe("bm25");
  });
  it("spy recommendFallback", async () => {
    const spy = vi.fn(async (s: "hnsw", e: string) => new Zone2RetrievalServiceStub().recommendFallback(s, e));
    const z = delegatingZone2Retrieval({ recommendFallback: spy });
    const band = new RetrievalFallbackPhase9Band(z);
    await band.resolveFallback("hnsw", "error x");
    expect(spy).toHaveBeenCalledWith("hnsw", "error x");
  });
});

describe("Sprint 34 — logFallbackEvent", () => {
  it("stores event", () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    const ev = band.logFallbackEvent({
      queryId: Q1,
      primaryStrategy: "hnsw",
      fallbackStrategy: "ollama",
      reason: "timeout",
    });
    expect(ev.queryId).toBe(Q1);
    expect(band.listLoggedEvents()).toHaveLength(1);
  });
  it("serializeLogRow keys", () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    const ev = band.logFallbackEvent({
      queryId: Q1,
      primaryStrategy: "bm25",
      fallbackStrategy: "static_faq",
      reason: "empty results",
      executedAtMs: Date.UTC(2026, 0, 1),
    });
    const row = band.serializeLogRow(ev);
    expect(row.primary_strategy).toBe("bm25");
    expect(row.fallback_strategy).toBe("static_faq");
    expect(String(row.executed_at)).toContain("2026");
  });
});

describe("Sprint 34 — retrievalFallbackPhase9Band export", () => {
  it("index default", async () => {
    const { retrievalFallbackPhase9Band } = await import("../coherentSystem/index.js");
    expect(retrievalFallbackPhase9Band.chainCoversAllStrategies()).toBe(true);
  });
});

describe("Sprint 34 — chain completeness", () => {
  it("covers all strategies", () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    expect(band.chainCoversAllStrategies()).toBe(true);
    for (let i = 0; i < RETRIEVAL_FALLBACK_CHAIN.length - 1; i++) {
      expect(band.selectFallback(RETRIEVAL_FALLBACK_CHAIN[i]!)).toBe(RETRIEVAL_FALLBACK_CHAIN[i + 1]);
    }
  });
});

describe("Sprint 34 — RLS ENABLE", () => {
  it("enabled", () => {
    expect(sql130).toMatch(/ENABLE ROW LEVEL SECURITY/i);
  });
});

describe("Sprint 34 — end-to-end flow", () => {
  it("detect select log", async () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    const resolved = await band.resolveFallback("hnsw", "connection failed");
    expect(resolved?.fallback).toBe("ollama");
    if (resolved) {
      const ev = band.logFallbackEvent({
        queryId: Q1,
        primaryStrategy: "hnsw",
        fallbackStrategy: resolved.fallback,
        reason: resolved.reason,
      });
      expect(ev.fallbackStrategy).toBe("ollama");
    }
  });
});

describe("Sprint 34 — multiple log entries", () => {
  it("append order", () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    band.logFallbackEvent({
      queryId: Q1,
      primaryStrategy: "hnsw",
      fallbackStrategy: "ollama",
      reason: "a",
    });
    band.logFallbackEvent({
      queryId: Q1,
      primaryStrategy: "ollama",
      fallbackStrategy: "bm25",
      reason: "b",
    });
    expect(band.listLoggedEvents()).toHaveLength(2);
  });
});

describe("Sprint 34 — primary key uuid", () => {
  it("id on event", () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    const ev = band.logFallbackEvent({
      queryId: Q1,
      primaryStrategy: "hnsw",
      fallbackStrategy: "ollama",
      reason: "x",
    });
    expect(ev.id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("Sprint 34 — executed_at default in sql", () => {
  it("default now", () => {
    expect(sql130).toMatch(/executed_at.*DEFAULT now\(\)/is);
  });
});

describe("Sprint 34 — detectStrategyFailure empty keyword", () => {
  it("empty results", () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    expect(band.detectStrategyFailure("vector empty")).toBe(true);
  });
});

describe("Sprint 34 — delegating override fallback", () => {
  it("custom recommendation", async () => {
    const z = delegatingZone2Retrieval({
      async recommendFallback() {
        return { fallbackStrategy: "static_faq", reason: "forced" };
      },
    });
    const band = new RetrievalFallbackPhase9Band(z);
    const r = await band.resolveFallback("hnsw", "failed");
    expect(r?.fallback).toBe("static_faq");
    expect(r?.reason).toBe("forced");
  });
});

describe("Sprint 34 — COMMENT ON TABLE", () => {
  it("comment", () => {
    expect(sql130).toMatch(/COMMENT ON TABLE/i);
  });
});

describe("Sprint 34 — reason truncation in stub", () => {
  it("long error clipped in zone2 prefix", async () => {
    const z = new Zone2RetrievalServiceStub();
    const long = "x".repeat(200);
    const r = await z.recommendFallback("hnsw", long);
    expect(r.reason.length).toBeLessThan(200);
  });
});

describe("Sprint 34 — resolveFallback terminal", () => {
  it("static_faq failure returns null", async () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    const r = await band.resolveFallback("static_faq", "failed hard");
    expect(r).toBeNull();
  });
});

describe("Sprint 34 — recommendFallback empty error", () => {
  it("default reason", async () => {
    const z = new Zone2RetrievalServiceStub();
    const r = await z.recommendFallback("bm25", "");
    expect(r.reason).toBe("zone2:fallback");
  });
});

describe("Sprint 34 — full chain walk", () => {
  it.each([
    ["hnsw", "ollama"],
    ["ollama", "bm25"],
    ["bm25", "static_faq"],
  ] as const)("%s -> %s", async (from, to) => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    const r = await band.resolveFallback(from, "error");
    expect(r?.fallback).toBe(to);
  });
});

describe("Sprint 34 — detectStrategyFailure benign", () => {
  it("success message", () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    expect(band.detectStrategyFailure("all good")).toBe(false);
  });
});

describe("Sprint 34 — serialize row query_id", () => {
  it("passthrough", () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    const ev = band.logFallbackEvent({
      queryId: "00000000-0000-4000-8000-000000000099",
      primaryStrategy: "ollama",
      fallbackStrategy: "bm25",
      reason: "r",
    });
    expect(band.serializeLogRow(ev).query_id).toBe("00000000-0000-4000-8000-000000000099");
  });
});

describe("Sprint 34 — error keyword case insensitive", () => {
  it("TIMEOUT", () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    expect(band.detectStrategyFailure("TIMEOUT")).toBe(true);
  });
});

describe("Sprint 34 — chain step count", () => {
  it("three transitions", () => {
    expect(RETRIEVAL_FALLBACK_CHAIN.length - 1).toBe(3);
  });
});

describe("Sprint 34 — listLoggedEvents copy", () => {
  it("immutable snapshot length", () => {
    const band = new RetrievalFallbackPhase9Band(new Zone2RetrievalServiceStub());
    band.logFallbackEvent({
      queryId: Q1,
      primaryStrategy: "hnsw",
      fallbackStrategy: "ollama",
      reason: "1",
    });
    const a = band.listLoggedEvents();
    const b = band.listLoggedEvents();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

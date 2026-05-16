import { randomUUID } from "node:crypto";
import type { Zone2RetrievalService } from "./zone2RetrievalTypes.js";

export interface InvalidationRule {
  readonly id: string;
  readonly pattern: string;
  readonly ttlSeconds: number;
  readonly triggerOn: string;
  readonly lastInvalidatedAtMs: number | null;
}

interface CacheEntry {
  readonly key: string;
  readonly storedAtMs: number;
}

/**
 * Sprint 33 — In-memory rule registry + stale purge vs Zone 2 TTL hints.
 */
export class RetrievalCacheInvalidationPhase8Band {
  private readonly rules = new Map<string, InvalidationRule>();
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly zone2: Zone2RetrievalService) {}

  async registerInvalidationRule(params: {
    readonly pattern: string;
    readonly cacheType: string;
    readonly triggerOn: string;
  }): Promise<InvalidationRule> {
    const hint = await this.zone2.suggestInvalidationTtl(params.cacheType);
    const rule: InvalidationRule = {
      id: randomUUID(),
      pattern: params.pattern,
      ttlSeconds: hint.ttlSeconds,
      triggerOn: params.triggerOn,
      lastInvalidatedAtMs: null,
    };
    this.rules.set(rule.id, rule);
    return rule;
  }

  checkRuleMatch(cacheKey: string, rule: InvalidationRule): boolean {
    if (!rule.pattern) {
      return false;
    }
    if (rule.pattern === "*") {
      return true;
    }
    return cacheKey.includes(rule.pattern);
  }

  touchCache(key: string, atMs = Date.now()): void {
    this.cache.set(key, { key, storedAtMs: atMs });
  }

  purgeStaleCache(nowMs = Date.now()): { readonly purgedKeys: readonly string[]; readonly rulesTouched: number } {
    const purged: string[] = [];
    let rulesTouched = 0;
    for (const rule of this.rules.values()) {
      let rulePurged = false;
      for (const [key, entry] of this.cache.entries()) {
        if (!this.checkRuleMatch(key, rule)) {
          continue;
        }
        const ageSec = (nowMs - entry.storedAtMs) / 1000;
        if (ageSec > rule.ttlSeconds) {
          this.cache.delete(key);
          purged.push(key);
          rulePurged = true;
        }
      }
      if (rulePurged) {
        rulesTouched += 1;
        this.rules.set(rule.id, { ...rule, lastInvalidatedAtMs: nowMs });
      }
    }
    return { purgedKeys: purged, rulesTouched };
  }

  listRules(): readonly InvalidationRule[] {
    return [...this.rules.values()];
  }
}

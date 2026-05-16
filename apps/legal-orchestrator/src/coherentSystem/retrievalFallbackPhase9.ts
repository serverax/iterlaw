import { randomUUID } from "node:crypto";
import type { RetrievalFallbackStrategy, Zone2RetrievalService } from "./zone2RetrievalTypes.js";

/** Ordered fallback chain: HNSW → Ollama → BM25 → static FAQ. */
export const RETRIEVAL_FALLBACK_CHAIN: readonly RetrievalFallbackStrategy[] = [
  "hnsw",
  "ollama",
  "bm25",
  "static_faq",
];

export interface FallbackLogEvent {
  readonly id: string;
  readonly queryId: string;
  readonly primaryStrategy: RetrievalFallbackStrategy;
  readonly fallbackStrategy: RetrievalFallbackStrategy;
  readonly reason: string;
  readonly executedAtMs: number;
}

/**
 * Sprint 34 — Detect primary strategy failure, select next chain step, log event.
 */
export class RetrievalFallbackPhase9Band {
  private readonly events: FallbackLogEvent[] = [];

  constructor(private readonly zone2: Zone2RetrievalService) {}

  detectStrategyFailure(error: string): boolean {
    const e = error.trim().toLowerCase();
    if (e.length === 0) {
      return false;
    }
    return (
      e.includes("timeout") ||
      e.includes("unavailable") ||
      e.includes("error") ||
      e.includes("failed") ||
      e.includes("empty")
    );
  }

  selectFallback(failedStrategy: RetrievalFallbackStrategy): RetrievalFallbackStrategy | null {
    const idx = RETRIEVAL_FALLBACK_CHAIN.indexOf(failedStrategy);
    if (idx < 0) {
      return "static_faq";
    }
    if (idx >= RETRIEVAL_FALLBACK_CHAIN.length - 1) {
      return null;
    }
    return RETRIEVAL_FALLBACK_CHAIN[idx + 1]!;
  }

  async resolveFallback(
    failedStrategy: RetrievalFallbackStrategy,
    error: string,
  ): Promise<{ readonly fallback: RetrievalFallbackStrategy; readonly reason: string } | null> {
    if (!this.detectStrategyFailure(error)) {
      return null;
    }
    const local = this.selectFallback(failedStrategy);
    if (local === null) {
      return null;
    }
    const zone2 = await this.zone2.recommendFallback(failedStrategy, error);
    return { fallback: zone2.fallbackStrategy, reason: zone2.reason };
  }

  logFallbackEvent(params: {
    readonly queryId: string;
    readonly primaryStrategy: RetrievalFallbackStrategy;
    readonly fallbackStrategy: RetrievalFallbackStrategy;
    readonly reason: string;
    readonly executedAtMs?: number;
  }): FallbackLogEvent {
    const event: FallbackLogEvent = {
      id: randomUUID(),
      queryId: params.queryId,
      primaryStrategy: params.primaryStrategy,
      fallbackStrategy: params.fallbackStrategy,
      reason: params.reason,
      executedAtMs: params.executedAtMs ?? Date.now(),
    };
    this.events.push(event);
    return event;
  }

  serializeLogRow(event: FallbackLogEvent): Record<string, unknown> {
    return {
      id: event.id,
      query_id: event.queryId,
      primary_strategy: event.primaryStrategy,
      fallback_strategy: event.fallbackStrategy,
      reason: event.reason,
      executed_at: new Date(event.executedAtMs).toISOString(),
    };
  }

  listLoggedEvents(): readonly FallbackLogEvent[] {
    return [...this.events];
  }

  chainCoversAllStrategies(): boolean {
    return RETRIEVAL_FALLBACK_CHAIN.length === 4;
  }
}

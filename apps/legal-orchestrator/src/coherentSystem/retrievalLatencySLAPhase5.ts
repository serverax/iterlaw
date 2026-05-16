import type { Zone2RetrievalService } from "./zone2RetrievalTypes.js";

function percentileLinear(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const clampedP = Math.min(100, Math.max(0, p));
  const rank = (clampedP / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const w = rank - lo;
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? a;
  return a * (1 - w) + b * w;
}

/** Deterministic p50 / p99 / p99.9 from latency samples (milliseconds). */
export function computePercentilesMs(samples: readonly number[]): {
  readonly p50: number;
  readonly p99: number;
  readonly p999: number;
} {
  const s = [...samples].sort((a, b) => a - b);
  return {
    p50: percentileLinear(s, 50),
    p99: percentileLinear(s, 99),
    p999: percentileLinear(s, 99.9),
  };
}

export interface LatencyMeasurementSnapshot {
  readonly queryId: string;
  readonly p50Ms: number;
  readonly p99Ms: number;
  readonly p999Ms: number;
  readonly slaTargetMs: number;
  readonly slaMet: boolean;
  readonly measuredAtMs: number;
}

/**
 * Sprint 30 — Latency percentiles vs Zone 2 SLA budget (p99 strictly less than target).
 */
export class RetrievalLatencySLAPhase5Band {
  constructor(private readonly zone2: Zone2RetrievalService) {}

  checkSLACompliance(p99Ms: number, slaTargetMs: number): boolean {
    return p99Ms < slaTargetMs;
  }

  async measureQueryLatency(params: {
    readonly queryId: string;
    readonly requestSize: number;
    readonly samplesMs: readonly number[];
  }): Promise<LatencyMeasurementSnapshot> {
    const budget = await this.zone2.computeLatencyBudget(params.requestSize);
    const p = computePercentilesMs(params.samplesMs);
    const slaMet = this.checkSLACompliance(p.p99, budget.slaTargetMs);
    return {
      queryId: params.queryId,
      p50Ms: p.p50,
      p99Ms: p.p99,
      p999Ms: p.p999,
      slaTargetMs: budget.slaTargetMs,
      slaMet,
      measuredAtMs: Date.now(),
    };
  }

  /** Shape aligned with `retrieval_latency_metrics` row (caller supplies DB id). */
  serializeMetricRow(snapshot: LatencyMeasurementSnapshot, rowId: string): Record<string, unknown> {
    return {
      id: rowId,
      query_id: snapshot.queryId,
      p50_ms: snapshot.p50Ms,
      p99_ms: snapshot.p99Ms,
      p999_ms: snapshot.p999Ms,
      sla_target_ms: snapshot.slaTargetMs,
      sla_met: snapshot.slaMet,
      measured_at: new Date(snapshot.measuredAtMs).toISOString(),
    };
  }
}

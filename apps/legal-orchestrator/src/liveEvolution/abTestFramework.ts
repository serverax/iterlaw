export type SegmentRules = {
  /** When set, flag applies only to these subscription tiers. */
  tiers?: string[];
};

export type AbMetricRow = {
  testId: string;
  variantVersion: number;
  conversionRate: number;
  errorRate: number;
  recordedAt: string;
};

/**
 * In-memory A/B flag + metrics (Sprint 19). Aligns with `ab_test_flags` / `ab_test_metrics` tables.
 */
export class ABTestFramework {
  private readonly flags = new Map<string, { enabled: boolean; segmentRules: SegmentRules }>();
  private readonly metrics: AbMetricRow[] = [];

  reset(): void {
    this.flags.clear();
    this.metrics.length = 0;
  }

  setFlag(flagName: string, enabled: boolean, segmentRules: SegmentRules = {}): void {
    this.flags.set(flagName, { enabled, segmentRules });
  }

  isEnabled(flagName: string, ctx: { tier: string }): boolean {
    const f = this.flags.get(flagName);
    if (!f?.enabled) {
      return false;
    }
    const tiers = f.segmentRules.tiers;
    if (!tiers || tiers.length === 0) {
      return true;
    }
    return tiers.includes(ctx.tier);
  }

  recordMetric(testId: string, variantVersion: number, conversionRate: number, errorRate: number): void {
    this.metrics.push({
      testId,
      variantVersion,
      conversionRate,
      errorRate,
      recordedAt: new Date().toISOString(),
    });
  }

  listMetrics(testId?: string): AbMetricRow[] {
    if (!testId) {
      return [...this.metrics];
    }
    return this.metrics.filter((m) => m.testId === testId);
  }
}

import type { SubscriptionTier } from "../memberAuth/subscriptionTier.js";

export interface AbMetricSample {
  testId: string;
  variantVersion: number;
  conversionRate: number;
  errorRate: number;
  recordedAt: string;
}

type FlagRow = { enabled: boolean; tiers?: SubscriptionTier[] };

/**
 * In-memory A/B flag + metric recorder (Sprint 19 slice).
 */
export class ABTestFramework {
  private readonly flags = new Map<string, FlagRow>();
  private readonly metrics: AbMetricSample[] = [];

  reset(): void {
    this.flags.clear();
    this.metrics.length = 0;
  }

  setFlag(name: string, enabled: boolean, rules: { tiers?: SubscriptionTier[] }): void {
    this.flags.set(name, {
      enabled,
      tiers: rules.tiers ? [...rules.tiers] : undefined,
    });
  }

  isEnabled(name: string, ctx: { tier: SubscriptionTier }): boolean {
    const f = this.flags.get(name);
    if (!f || !f.enabled) {
      return false;
    }
    if (!f.tiers || f.tiers.length === 0) {
      return true;
    }
    return f.tiers.includes(ctx.tier);
  }

  recordMetric(testId: string, variantVersion: number, conversionRate: number, errorRate: number): void {
    this.metrics.unshift({
      testId,
      variantVersion,
      conversionRate,
      errorRate,
      recordedAt: new Date().toISOString(),
    });
  }

  listMetrics(testId?: string): AbMetricSample[] {
    if (testId === undefined) {
      return [...this.metrics];
    }
    return this.metrics.filter((m) => m.testId === testId);
  }
}

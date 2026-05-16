import type { SubscriptionTier } from "./subscriptionTier.js";
import { tierDailyRequestBudget } from "./subscriptionTier.js";

type Clock = () => Date;

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * In-memory per-user daily counter for tier rate limits (Zone 1 edge / tests).
 * Resets when the UTC calendar day changes for the clock.
 */
export class TierDailyRateLimiter {
  private readonly state = new Map<string, { day: string; count: number }>();

  constructor(private readonly clock: Clock = () => new Date()) {}

  reset(): void {
    this.state.clear();
  }

  consume(userId: string, tier: SubscriptionTier): { allowed: boolean; remaining: number | null } {
    const budget = tierDailyRequestBudget(tier);
    if (budget === null) {
      return { allowed: true, remaining: null };
    }
    const day = utcDayKey(this.clock());
    const key = `${userId}:${tier}`;
    let row = this.state.get(key);
    if (!row || row.day !== day) {
      row = { day, count: 0 };
      this.state.set(key, row);
    }
    if (row.count >= budget) {
      return { allowed: false, remaining: 0 };
    }
    row.count += 1;
    return { allowed: true, remaining: budget - row.count };
  }
}

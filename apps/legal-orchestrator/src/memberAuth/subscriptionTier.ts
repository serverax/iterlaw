export type SubscriptionTier = "FREE" | "PRO" | "ENTERPRISE";

export function isSubscriptionTier(v: string): v is SubscriptionTier {
  return v === "FREE" || v === "PRO" || v === "ENTERPRISE";
}

/**
 * Effective per-day request budget for the tier. `null` means unlimited.
 */
export function tierDailyRequestBudget(tier: SubscriptionTier): number | null {
  switch (tier) {
    case "FREE":
      return 10;
    case "PRO":
      return 1000;
    case "ENTERPRISE":
      return null;
    default: {
      const _exhaustive: never = tier;
      return _exhaustive;
    }
  }
}

/**
 * Row value for user_subscriptions.rate_limit_requests_per_day (ENTERPRISE => NULL).
 */
export function tierRateLimitColumn(tier: SubscriptionTier): number | null {
  return tierDailyRequestBudget(tier);
}

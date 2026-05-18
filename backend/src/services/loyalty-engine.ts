export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type SubscriptionPlan = 'free' | 'essential' | 'active_case';

const TIER_THRESHOLDS: { tier: LoyaltyTier; minPoints: number }[] = [
  { tier: 'platinum', minPoints: 500 },
  { tier: 'gold', minPoints: 250 },
  { tier: 'silver', minPoints: 100 },
  { tier: 'bronze', minPoints: 0 },
];

const TIER_DISCOUNT_PERCENT: Record<LoyaltyTier, number> = {
  bronze: 0,
  silver: 5,
  gold: 10,
  platinum: 15,
};

export function resolveLoyaltyTier(points: number): LoyaltyTier {
  for (const { tier, minPoints } of TIER_THRESHOLDS) {
    if (points >= minPoints) return tier;
  }
  return 'bronze';
}

export function subscriptionDiscountPercent(tier: LoyaltyTier, plan: SubscriptionPlan): number {
  if (plan === 'free') return 0;
  return TIER_DISCOUNT_PERCENT[tier];
}

export function applySubscriptionDiscount(
  basePricePence: number,
  tier: LoyaltyTier,
  plan: SubscriptionPlan
): { finalPricePence: number; discountPercent: number } {
  const discountPercent = subscriptionDiscountPercent(tier, plan);
  const finalPricePence = Math.round(basePricePence * (1 - discountPercent / 100));
  return { finalPricePence, discountPercent };
}

export function awardPointsForQuestion(currentPoints: number, isEscalated: boolean): number {
  return currentPoints + (isEscalated ? 25 : 10);
}

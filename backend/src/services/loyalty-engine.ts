import type { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils/logger';

const logger = new Logger('LoyaltyEngine');

export interface LoyaltyTier {
  name: string;
  points: number;
  discountPercent: number;
  freeQuestionsPerMonth: number;
  benefits: string[];
}

export const LOYALTY_TIERS: Record<string, LoyaltyTier> = {
  aware: {
    name: 'aware',
    points: 0,
    discountPercent: 0,
    freeQuestionsPerMonth: 3,
    benefits: ['3 free questions/month', '1 document upload'],
  },
  informed: {
    name: 'informed',
    points: 500,
    discountPercent: 10,
    freeQuestionsPerMonth: 5,
    benefits: ['5 free questions/month', '10% off subscription', '5 document uploads'],
  },
  empowered: {
    name: 'empowered',
    points: 1500,
    discountPercent: 20,
    freeQuestionsPerMonth: 8,
    benefits: ['8 free questions/month', '20% off subscription', 'Unlimited documents'],
  },
  champion: {
    name: 'champion',
    points: 4000,
    discountPercent: 30,
    freeQuestionsPerMonth: 999,
    benefits: ['Unlimited free questions', '30% off forever', 'Free solicitor intro call'],
  },
};

export function calculateUserTier(points: number): string {
  if (points >= LOYALTY_TIERS.champion.points) return 'champion';
  if (points >= LOYALTY_TIERS.empowered.points) return 'empowered';
  if (points >= LOYALTY_TIERS.informed.points) return 'informed';
  return 'aware';
}

export function getTierInfo(tier: string): LoyaltyTier {
  return LOYALTY_TIERS[tier] ?? LOYALTY_TIERS.aware;
}

export async function applyLoyaltyRewards(sb: SupabaseClient, userId: string): Promise<string> {
  const { data: user, error } = await sb.from('users').select('loyalty_points,tier').eq('id', userId).single();
  if (error || !user) throw new Error(`User not found: ${userId}`);

  const points = (user.loyalty_points as number | null) ?? 0;
  const newTier = calculateUserTier(points);
  const oldTier = (user.tier as string | null) ?? 'aware';

  if (oldTier !== newTier) {
    await sb.from('users').update({ tier: newTier, tier_updated_at: new Date().toISOString() }).eq('id', userId);
    logger.info(`User ${userId} promoted: ${oldTier} → ${newTier}`);
  }

  const tierInfo = getTierInfo(newTier);
  if (tierInfo.discountPercent > 0) {
    const { data: subs } = await sb
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1);
    if (subs?.[0]) {
      await sb
        .from('subscriptions')
        .update({
          loyalty_discount_percent: tierInfo.discountPercent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subs[0].id);
    }
  }

  return newTier;
}

export async function awardLoyaltyPoints(
  sb: SupabaseClient,
  userId: string,
  points: number,
  reason: string
): Promise<number> {
  const { data, error } = await sb.rpc('increment_loyalty_points', { user_id: userId, delta: points });
  if (error) {
    const { data: user } = await sb.from('users').select('loyalty_points').eq('id', userId).single();
    const current = (user?.loyalty_points as number | null) ?? 0;
    const newPoints = current + points;
    await sb
      .from('users')
      .update({ loyalty_points: newPoints, loyalty_updated_at: new Date().toISOString() })
      .eq('id', userId);
    logger.info(`Awarded ${points} points to ${userId} (${reason}) — total: ${newPoints}`);
    await applyLoyaltyRewards(sb, userId);
    return newPoints;
  }
  const newPoints = (data as number | null) ?? points;
  await applyLoyaltyRewards(sb, userId);
  return newPoints;
}

export async function awardLoyaltyPointsForQuestion(
  sb: SupabaseClient,
  userId: string
): Promise<void> {
  await awardLoyaltyPoints(sb, userId, 10, 'asked_question_and_read_answer');
}

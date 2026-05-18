import { calculateUserTier, getTierInfo, LOYALTY_TIERS } from '../loyalty-engine';

describe('Loyalty Engine', () => {
  it('should calculate tier: aware (0 points)', () => {
    expect(getTierInfo('aware').discountPercent).toBe(0);
    expect(calculateUserTier(0)).toBe('aware');
  });

  it('should calculate tier: informed (500 points)', () => {
    expect(getTierInfo('informed').discountPercent).toBe(10);
    expect(calculateUserTier(500)).toBe('informed');
  });

  it('should calculate tier: champion (4000 points)', () => {
    expect(getTierInfo('champion').discountPercent).toBe(30);
    expect(getTierInfo('champion').freeQuestionsPerMonth).toBe(999);
    expect(calculateUserTier(4000)).toBe('champion');
  });

  it('exposes tier catalog', () => {
    expect(LOYALTY_TIERS.informed.points).toBe(500);
  });
});

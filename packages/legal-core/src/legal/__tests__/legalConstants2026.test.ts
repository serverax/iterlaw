import { LOWER_EARNINGS_LIMIT_WEEKLY_GBP, NLW_21_PLUS_HOURLY_GBP, SSP_WEEKLY_RATE_CAP_GBP } from '../constants/ukEmploymentRates2026';

describe('UK employment constants (2026 snapshot)', () => {
  it('exposes NLW, SSP cap, and LEL figures used by calculators', () => {
    expect(NLW_21_PLUS_HOURLY_GBP).toBe(12.71);
    expect(SSP_WEEKLY_RATE_CAP_GBP).toBe(123.25);
    expect(LOWER_EARNINGS_LIMIT_WEEKLY_GBP).toBe(129);
  });
});

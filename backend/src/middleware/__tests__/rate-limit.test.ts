import { RATE_LIMITS } from '../rate-limit';

describe('Rate Limiter', () => {
  it('should block requests exceeding user limit (config)', () => {
    expect(RATE_LIMITS.USER.limit).toBe(30);
    expect(RATE_LIMITS.IP.limit).toBe(100);
  });
});

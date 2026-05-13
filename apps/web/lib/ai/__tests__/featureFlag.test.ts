import {
  ITERLAW_WEB_AI_FALLBACK_FLAG_ENV,
  WEB_AI_FALLBACK_DISABLED_MESSAGE,
  isWebAiFallbackEnabled,
} from '../featureFlag';

describe('IterLaw web AI fallback feature flag', () => {
  it('exports the canonical env var name', () => {
    expect(ITERLAW_WEB_AI_FALLBACK_FLAG_ENV).toBe('ITERLAW_WEB_AI_FALLBACK_ENABLED');
  });

  it('is OFF when env var is unset', () => {
    expect(isWebAiFallbackEnabled({})).toBe(false);
  });

  it('is OFF for empty string, whitespace, "false", "0", "no", arbitrary text', () => {
    expect(isWebAiFallbackEnabled({ [ITERLAW_WEB_AI_FALLBACK_FLAG_ENV]: '' })).toBe(false);
    expect(isWebAiFallbackEnabled({ [ITERLAW_WEB_AI_FALLBACK_FLAG_ENV]: '   ' })).toBe(false);
    expect(isWebAiFallbackEnabled({ [ITERLAW_WEB_AI_FALLBACK_FLAG_ENV]: 'false' })).toBe(false);
    expect(isWebAiFallbackEnabled({ [ITERLAW_WEB_AI_FALLBACK_FLAG_ENV]: '0' })).toBe(false);
    expect(isWebAiFallbackEnabled({ [ITERLAW_WEB_AI_FALLBACK_FLAG_ENV]: 'no' })).toBe(false);
    expect(isWebAiFallbackEnabled({ [ITERLAW_WEB_AI_FALLBACK_FLAG_ENV]: 'maybe' })).toBe(false);
  });

  it('is ON only for explicit "true" or "1" (case-insensitive)', () => {
    expect(isWebAiFallbackEnabled({ [ITERLAW_WEB_AI_FALLBACK_FLAG_ENV]: 'true' })).toBe(true);
    expect(isWebAiFallbackEnabled({ [ITERLAW_WEB_AI_FALLBACK_FLAG_ENV]: 'TRUE' })).toBe(true);
    expect(isWebAiFallbackEnabled({ [ITERLAW_WEB_AI_FALLBACK_FLAG_ENV]: '1' })).toBe(true);
    expect(isWebAiFallbackEnabled({ [ITERLAW_WEB_AI_FALLBACK_FLAG_ENV]: '  true  ' })).toBe(true);
  });

  it('explains the refusal contract in the disabled message', () => {
    expect(WEB_AI_FALLBACK_DISABLED_MESSAGE).toMatch(/disabled by default/i);
    expect(WEB_AI_FALLBACK_DISABLED_MESSAGE).toContain('ITERLAW_WEB_AI_FALLBACK_ENABLED');
    expect(WEB_AI_FALLBACK_DISABLED_MESSAGE).toMatch(/legal-orchestrator/);
    expect(WEB_AI_FALLBACK_DISABLED_MESSAGE).toMatch(/transport deny policy/i);
  });

  it('does not read secret env values', () => {
    // The flag is a non-secret toggle. Sanity-check the function ignores secret-like
    // env vars by feeding noise: only the canonical flag name matters.
    const noisy = {
      ANTHROPIC_API_KEY: 'should-not-trigger-anything',
      GOOGLE_AI_API_KEY: 'should-not-trigger-anything',
      DATABASE_URL: 'postgres://should-not-trigger-anything',
    };
    expect(isWebAiFallbackEnabled(noisy)).toBe(false);
  });
});

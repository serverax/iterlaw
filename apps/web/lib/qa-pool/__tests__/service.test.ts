jest.mock('@/lib/supabase/client', () => ({
  getServiceSupabase: jest.fn(),
}));

import * as supabase from '@/lib/supabase/client';
import { findCachedUserAnswer, upsertCachedUserAnswer } from '@/lib/qa-pool/service';

describe('qa-pool service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when Supabase is not configured', async () => {
    (supabase.getServiceSupabase as jest.Mock).mockReturnValue(null);
    await expect(findCachedUserAnswer('any question here?', 'england_wales')).resolves.toBeNull();
  });

  it('returns cached payload when row exists', async () => {
    const from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                answer: {
                  law: 'L',
                  meaning: 'M',
                  action: 'A',
                  source: { title: 't', citation: 'c' },
                  confidence: 0.9,
                  cached: true,
                },
              },
              error: null,
            }),
          }),
        }),
      }),
    });
    (supabase.getServiceSupabase as jest.Mock).mockReturnValue({ from });
    const hit = await findCachedUserAnswer('any question here?', 'england_wales');
    expect(hit?.source).toBe('cache');
    expect(hit?.answer.cached).toBe(true);
  });

  it('skips upsert when Supabase is not configured', async () => {
    (supabase.getServiceSupabase as jest.Mock).mockReturnValue(null);
    await expect(
      upsertCachedUserAnswer({
        question: 'any question here?',
        jurisdiction: 'england_wales',
        answer: {
          law: 'L',
          meaning: 'M',
          action: 'A',
          source: { title: 't', citation: 'c' },
          confidence: 0.9,
          cached: false,
        },
        answerSource: 'gov',
      })
    ).resolves.toEqual({ ok: true, skipped: true });
  });
});

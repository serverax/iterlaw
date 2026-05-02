import { computeContentHash, normaliseQuestion } from '@/lib/qa-pool/content-hash';

describe('qa-pool content hash', () => {
  it('normalises whitespace and case', () => {
    expect(normaliseQuestion('  Hello   World  ')).toBe('hello world');
  });

  it('is stable for the same question + jurisdiction', () => {
    const a = computeContentHash('What is notice pay?', 'england_wales');
    const b = computeContentHash('  what is notice pay?  ', 'england_wales');
    expect(a).toBe(b);
  });

  it('differs by jurisdiction', () => {
    const a = computeContentHash('Same text', 'england_wales');
    const b = computeContentHash('Same text', 'scotland');
    expect(a).not.toBe(b);
  });
});

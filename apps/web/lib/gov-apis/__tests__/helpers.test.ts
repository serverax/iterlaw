import { calculateRelevance, extractCompanyName, extractKeywords } from '../helpers';

describe('extractKeywords', () => {
  it('removes stopwords and punctuation', () => {
    const q = 'Can my employer dismiss me without a disciplinary hearing?';
    const k = extractKeywords(q);
    expect(k).toContain('employer');
    expect(k).toContain('dismiss');
    expect(k).not.toContain('can');
  });
});

describe('calculateRelevance', () => {
  it('scores higher when more keywords appear', () => {
    const q = 'redundancy pay statutory';
    const high = calculateRelevance(q, 'statutory redundancy pay guidance');
    const low = calculateRelevance(q, 'unrelated content about gardening');
    expect(high).toBeGreaterThan(low);
  });

  it('returns 0 for empty keyword set', () => {
    expect(calculateRelevance('a b c', 'hello')).toBe(0);
  });
});

describe('extractCompanyName', () => {
  it('extracts Ltd name', () => {
    expect(extractCompanyName('I work at Acme Widgets Ltd in London')).toContain('Acme');
  });
});

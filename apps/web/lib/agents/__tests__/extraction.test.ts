import { extractFactsFromDocument } from '@/lib/agents/extraction-engine';

describe('AEE — extraction-engine', () => {
  it('extracts candidate facts from narrative text', () => {
    const text =
      'I started work in January 2022. My manager raised a grievance about my conduct in March. I was dismissed without notice in April. I believe this was unfair.';
    const { facts, confidence } = extractFactsFromDocument(text);
    expect(facts.length).toBeGreaterThan(0);
    expect(confidence).toBeGreaterThanOrEqual(0.45);
    expect(confidence).toBeLessThanOrEqual(0.94);
    expect(facts[0]?.id).toBe('fact_1');
  });

  it('returns low confidence for very short documents', () => {
    const { facts, confidence } = extractFactsFromDocument(
      'This is too short. No real narrative here. Still short.'
    );
    expect(facts.length).toBe(0);
    expect(confidence).toBeLessThanOrEqual(0.5);
  });
});

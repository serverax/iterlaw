import { normaliseAiResponse, parseJsonObject } from '../json';

describe('parseJsonObject', () => {
  it('parses raw JSON', () => {
    expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses fenced JSON', () => {
    const text = 'Here:\n```json\n{"class":"IN_SCOPE_SIMPLE"}\n```';
    expect(parseJsonObject(text)).toEqual({ class: 'IN_SCOPE_SIMPLE' });
  });

  it('parses embedded object substring', () => {
    const text = 'prefix {"x":2} suffix';
    expect(parseJsonObject(text)).toEqual({ x: 2 });
  });

  it('throws when JSON cannot be recovered', () => {
    expect(() => parseJsonObject('not json at all')).toThrow();
  });
});

describe('normaliseAiResponse', () => {
  it('maps fields', () => {
    const r = normaliseAiResponse({
      law_section: 'ERA 1996',
      meaning: 'Meaning',
      action: 'Action',
      source_citation: 'ERA 1996, s.94',
      confidence_score: 0.8,
    });
    expect(r.confidence_score).toBe(0.8);
  });
});

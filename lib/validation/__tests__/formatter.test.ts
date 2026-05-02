import {
  escapeHtml,
  extractLawSection,
  formatAnswer,
  formatMeaning,
  toUserAnswer,
} from '../formatter';
import type { AnswerSource } from '../types';

describe('extractLawSection', () => {
  it('prefers citeAs when present', () => {
    expect(extractLawSection('any', 'Section 135')).toBe('Section 135');
  });

  it('extracts Employment Rights Act from content', () => {
    const text = 'Your rights under the Employment Rights Act 1996 include redundancy pay.';
    expect(extractLawSection(text)).toMatch(/Employment Rights Act/i);
  });
});

describe('formatMeaning', () => {
  it('prefixes context when provided', () => {
    const text = 'You may be entitled to a payment.';
    const out = formatMeaning(text, {
      jurisdiction: 'england_wales',
      situation_type: 'redundancy',
      employment_dates: '3 years',
    });
    expect(out).toContain('redundancy');
    expect(out).toContain('3 years');
  });

  it('truncates very long content', () => {
    const long = `${'word '.repeat(200)}end`;
    const out = formatMeaning(long);
    expect(out.length).toBeLessThanOrEqual(503);
    expect(out.endsWith('...')).toBe(true);
  });

  it('falls back when stripping removes everything', () => {
    const out = formatMeaning('Section 12 https://example.com');
    expect(out.length).toBeGreaterThan(20);
  });
});

describe('formatAnswer', () => {
  it('uses default law label when no citation patterns match', () => {
    const src: AnswerSource = {
      content: 'General workplace guidance with no statute references.',
      url: 'https://www.gov.uk/',
      source: 'GOV_API',
      relevanceScore: 0.6,
    };
    const formatted = formatAnswer(src);
    expect(formatted.law_section).toContain('UK employment law');
  });

  it('formats a GOV_API source into three parts', () => {
    const src: AnswerSource = {
      title: 'Redundancy pay',
      content: 'Employment Rights Act 1996 Section 135. You may be entitled to a payment.',
      url: 'https://www.gov.uk/redundancy-your-rights',
      source: 'GOV_API',
      citeAs: 'Section 135',
      relevanceScore: 0.95,
    };
    const formatted = formatAnswer(src);
    expect(formatted.law_section).toContain('Section 135');
    expect(formatted.meaning.length).toBeGreaterThan(10);
    expect(formatted.action).toContain('GOV.UK');
    expect(formatted.source_url).toBe(src.url);
    expect(formatted.source_type).toBe('GOV_API');
  });

  it('formats AI and CACHED actions', () => {
    const ai = formatAnswer({
      content: 'Some text',
      url: 'https://example.com',
      source: 'AI',
      citeAs: 'Guidance summary',
      relevanceScore: 0.4,
    });
    expect(ai.action).toContain('Verify');

    const cached = formatAnswer({
      content: 'Some text',
      url: 'https://example.com',
      source: 'CACHED',
      citeAs: 'Guidance summary',
      relevanceScore: 0.8,
    });
    expect(cached.action).toContain('dated copy');
    expect(cached.source_type).toBe('GOV_API');
  });
});

describe('escapeHtml + toUserAnswer', () => {
  it('escapes HTML-sensitive characters', () => {
    expect(escapeHtml('<script>alert(1)</script>')).not.toContain('<script>');
  });

  it('builds a user answer payload', () => {
    const formatted = formatAnswer({
      content: 'Equality Act 2010 section 13. Harassment is unlawful discrimination.',
      url: 'https://www.gov.uk/',
      source: 'GOV_API',
      citeAs: 'Equality Act 2010, section 13',
      relevanceScore: 0.9,
    });
    const ua = toUserAnswer(formatted, 0.92, 'Disclaimer');
    expect(ua.cached).toBe(false);
    expect(ua.confidence).toBe(0.92);
    expect(ua.disclaimer).toContain('Disclaimer');
  });

  it('marks cached answers when requested', () => {
    const formatted = formatAnswer({
      content: 'ERA 1996. Notice.',
      url: 'https://www.gov.uk/',
      source: 'GOV_API',
      citeAs: 'ERA 1996',
      relevanceScore: 0.9,
    });
    const ua = toUserAnswer(formatted, 0.9, undefined, { cached: true });
    expect(ua.cached).toBe(true);
  });
});

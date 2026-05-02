import type { FormattedAnswer } from '../types';
import { validateAnswer, ValidationRules } from '../validator';

const baseAnswer = (): FormattedAnswer => ({
  law_section: 'Employment Rights Act 1996, Section 94',
  meaning: 'You may have the right to claim unfair dismissal if you qualify as an employee and meet service rules.',
  action: 'Contact ACAS on 0300 123 1100 for free, impartial advice.',
  source_citation: 'Employment Rights Act 1996, section 94',
  source_url: 'https://www.gov.uk/dismissal',
  source_type: 'GOV_API',
  confidence_score: 0.85,
});

describe('validateAnswer', () => {
  it('passes a fully valid GOV_API answer', () => {
    const answer = baseAnswer();
    const result = validateAnswer(answer);
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.formatted).toEqual(answer);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.escalate).toBe(false);
  });

  it('rejects missing law_section', () => {
    const answer = { ...baseAnswer(), law_section: '   ' };
    const result = validateAnswer(answer);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('What the law says'))).toBe(true);
  });

  it('rejects banned phrase you should', () => {
    const answer = { ...baseAnswer(), action: 'You should email your employer tonight.' };
    const result = validateAnswer(answer);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('you should'))).toBe(true);
  });

  it('rejects banned word advise (word boundary)', () => {
    const answer = { ...baseAnswer(), meaning: 'We advise you to contact ACAS.' };
    const result = validateAnswer(answer);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('advise'))).toBe(true);
  });

  it('does not flag adviser substring as advise', () => {
    const answer = {
      ...baseAnswer(),
      meaning: 'You can speak to an adviser at ACAS.',
    };
    const result = validateAnswer(answer);
    expect(result.passed).toBe(true);
  });

  it('rejects short citation', () => {
    const answer = { ...baseAnswer(), source_citation: 'ERA' };
    const result = validateAnswer(answer);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('citation'))).toBe(true);
  });

  it('requires source_url for LEGISLATION', () => {
    const answer: FormattedAnswer = {
      ...baseAnswer(),
      source_type: 'LEGISLATION',
      source_url: undefined,
    };
    const result = validateAnswer(answer);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('source_url'))).toBe(true);
  });

  it('adds disclaimer for mid-band confidence after boosts', () => {
    const answer: FormattedAnswer = {
      ...baseAnswer(),
      confidence_score: 0.45,
      source_type: 'GOV_API',
    };
    const result = validateAnswer(answer);
    expect(result.passed).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(ValidationRules.CONFIDENCE_THRESHOLD_ESCALATE);
    expect(result.confidence).toBeLessThan(ValidationRules.CONFIDENCE_THRESHOLD_CAUTION);
    expect(result.disclaimer).toBe(ValidationRules.DISCLAIMER_CAUTION);
  });

  it('flags escalate when confidence remains below threshold', () => {
    const answer: FormattedAnswer = {
      ...baseAnswer(),
      confidence_score: 0.05,
      source_type: 'AI',
    };
    const result = validateAnswer(answer);
    expect(result.passed).toBe(true);
    expect(result.confidence).toBeLessThan(ValidationRules.CONFIDENCE_THRESHOLD_ESCALATE);
    expect(result.escalate).toBe(true);
  });

  it('applies failure penalty when structural checks fail', () => {
    const answer = { ...baseAnswer(), law_section: '' };
    const result = validateAnswer(answer);
    expect(result.passed).toBe(false);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

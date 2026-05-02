import type { FormattedAnswer, ValidationResult } from './types';

export const ValidationRules = {
  BANNED_PHRASES: [
    'advise',
    'advises',
    'advised',
    'advising',
    'recommend',
    'recommends',
    'recommended',
    'recommending',
    'you should',
    'i think',
    'in my opinion',
    'my opinion',
    'i believe',
  ] as const,
  MIN_CITATION_LENGTH: 5,
  CONFIDENCE_BOOST_GOV_API: 0.25,
  CONFIDENCE_BOOST_LEGISLATION: 0.2,
  CONFIDENCE_BOOST_CASELAW: 0.1,
  CONFIDENCE_PENALTY_FAILED: 0.3,
  CONFIDENCE_THRESHOLD_ESCALATE: 0.65,
  CONFIDENCE_THRESHOLD_CAUTION: 0.85,
  DISCLAIMER_CAUTION:
    'This answer comes from AI reasoning. Verify with official sources or a solicitor before acting.',
} as const;

function containsBannedLanguage(text: string): string | null {
  const lower = text.toLowerCase();

  for (const phrase of ValidationRules.BANNED_PHRASES) {
    if (phrase.includes(' ')) {
      if (lower.includes(phrase)) {
        return phrase;
      }
      continue;
    }

    const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(lower)) {
      return phrase;
    }
  }

  return null;
}

function applyConfidenceRules(answer: FormattedAnswer, passed: boolean): number {
  let confidence = answer.confidence_score;
  if (!Number.isFinite(confidence)) confidence = 0.5;
  confidence = Math.min(1, Math.max(0, confidence));

  switch (answer.source_type) {
    case 'GOV_API':
      confidence = Math.min(1, confidence + ValidationRules.CONFIDENCE_BOOST_GOV_API);
      break;
    case 'LEGISLATION':
      confidence = Math.min(1, confidence + ValidationRules.CONFIDENCE_BOOST_LEGISLATION);
      break;
    case 'CASELAW':
      confidence = Math.min(1, confidence + ValidationRules.CONFIDENCE_BOOST_CASELAW);
      break;
    default:
      break;
  }

  if (!passed) {
    confidence = Math.max(0, confidence - ValidationRules.CONFIDENCE_PENALTY_FAILED);
  }

  return Math.min(1, Math.max(0, Number(confidence.toFixed(4))));
}

export function validateAnswer(answer: FormattedAnswer): ValidationResult {
  const errors: string[] = [];

  if (!answer.law_section?.trim()) {
    errors.push("Missing 'What the law says' section");
  }
  if (!answer.meaning?.trim()) {
    errors.push("Missing 'What this means for you' section");
  }
  if (!answer.action?.trim()) {
    errors.push("Missing 'What to do tonight' section");
  }

  const combined = [answer.law_section, answer.meaning, answer.action].join(' ');
  const banned = containsBannedLanguage(combined);
  if (banned) {
    errors.push(`Found banned language: "${banned}"`);
  }

  if (!answer.source_citation?.trim() || answer.source_citation.trim().length < ValidationRules.MIN_CITATION_LENGTH) {
    errors.push('Source citation missing or too short (min 5 chars)');
  }

  if (answer.source_type === 'GOV_API' || answer.source_type === 'LEGISLATION') {
    if (!answer.source_url?.trim()) {
      errors.push(`Source type ${answer.source_type} requires source_url`);
    }
  }

  const passed = errors.length === 0;
  const confidence = applyConfidenceRules(answer, passed);

  let disclaimer: string | undefined;
  if (
    passed &&
    confidence >= ValidationRules.CONFIDENCE_THRESHOLD_ESCALATE &&
    confidence < ValidationRules.CONFIDENCE_THRESHOLD_CAUTION
  ) {
    disclaimer = ValidationRules.DISCLAIMER_CAUTION;
  }

  const escalate = passed && confidence < ValidationRules.CONFIDENCE_THRESHOLD_ESCALATE;

  return {
    passed,
    confidence,
    disclaimer,
    errors,
    formatted: passed ? answer : undefined,
    escalate,
  };
}

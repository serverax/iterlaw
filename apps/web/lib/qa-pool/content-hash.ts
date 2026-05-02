import { createHash } from 'crypto';

/** Normalise free-text questions for stable cache keys. */
export function normaliseQuestion(question: string): string {
  return question.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function computeContentHash(question: string, jurisdiction: string): string {
  const key = `${jurisdiction}|${normaliseQuestion(question)}`;
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

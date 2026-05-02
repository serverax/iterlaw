import type { LegalFact } from '@/types';

const MAX_FACTS = 24;

function inferLabel(sentence: string, index: number): string {
  const lower = sentence.toLowerCase();
  if (lower.includes('dismiss') || lower.includes('redund')) return 'Dismissal or redundancy';
  if (lower.includes('grievance') || lower.includes('complaint')) return 'Grievance';
  if (lower.includes('discriminat')) return 'Discrimination';
  if (lower.includes('pay') || lower.includes('wage') || lower.includes('salary')) return 'Pay';
  if (lower.includes('notice')) return 'Notice';
  if (lower.includes('sick') || lower.includes('leave')) return 'Leave';
  if (lower.includes('acas')) return 'ACAS / procedure';
  return `Extracted point ${index + 1}`;
}

function clampConfidence(value: number): number {
  return Math.min(0.94, Math.max(0.35, Math.round(value * 100) / 100));
}

/**
 * AEE — Axiom Extraction Engine (deterministic baseline).
 * Parses narrative text into candidate facts for user review.
 */
export function extractFactsFromDocument(documentText: string): { facts: LegalFact[]; confidence: number } {
  const normalized = documentText.replace(/\s+/g, ' ').trim();
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 28);

  const facts: LegalFact[] = sentences.slice(0, MAX_FACTS).map((sentence, i) => ({
    id: `fact_${i + 1}`,
    label: inferLabel(sentence, i),
    value: sentence.slice(0, 2000),
    confidence: clampConfidence(0.68 + Math.min(0.22, i * 0.012)),
    sourceSpan: sentence.slice(0, 320),
  }));

  const extractionConfidence = facts.length ? clampConfidence(0.8 + Math.min(0.14, facts.length * 0.008)) : 0.45;
  return { facts, confidence: extractionConfidence };
}

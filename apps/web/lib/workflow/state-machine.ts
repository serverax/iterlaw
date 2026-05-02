import type { CaseState } from '@/types';

const ALLOWED: Record<CaseState, CaseState[]> = {
  intake: ['facts_review', 'escalated'],
  facts_review: ['reasoning', 'escalated', 'intake'],
  reasoning: ['drafting', 'escalated'],
  drafting: ['complete', 'escalated'],
  complete: [],
  escalated: [],
};

export function canTransition(from: CaseState, to: CaseState): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(from: CaseState, to: CaseState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid case transition: ${from} → ${to}`);
  }
}

export function isTerminal(state: CaseState): boolean {
  return state === 'complete' || state === 'escalated';
}

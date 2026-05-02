import { assertTransition, canTransition, isTerminal } from '@/lib/workflow/state-machine';

describe('case state machine', () => {
  it('allows intake → facts_review', () => {
    expect(canTransition('intake', 'facts_review')).toBe(true);
  });

  it('blocks illegal jumps', () => {
    expect(canTransition('intake', 'complete')).toBe(false);
    expect(canTransition('facts_review', 'intake')).toBe(true);
  });

  it('assertTransition throws on invalid moves', () => {
    expect(() => assertTransition('intake', 'complete')).toThrow('Invalid case transition');
  });

  it('marks terminal states', () => {
    expect(isTerminal('complete')).toBe(true);
    expect(isTerminal('escalated')).toBe(true);
    expect(isTerminal('intake')).toBe(false);
  });
});

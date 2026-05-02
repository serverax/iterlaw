import { artEmploymentSystemBundle, traceEmploymentLaw } from '@/lib/agents/axiom-employment/reasoning-employment';
import { buildAxiomTrace } from '@/lib/agents/reasoning-tracer';

describe('ART — employment reasoning', () => {
  it('returns five structured steps and a merit score', () => {
    const facts = [
      {
        id: 'f1',
        label: 'Dismissal',
        value: 'The employer dismissed the worker without notice.',
        confidence: 0.8,
        userConfirmed: true,
      },
    ];
    const trace = traceEmploymentLaw('case-1', facts, 'england_wales');
    expect(trace.steps).toHaveLength(5);
    expect(trace.meritScore).toBeGreaterThanOrEqual(38);
    expect(trace.meritScore).toBeLessThanOrEqual(92);
    expect(trace.steps[1]?.statutoryAnchor).toBeTruthy();
  });

  it('routes discrimination facts to Equality Act anchor', () => {
    const facts = [
      {
        id: 'f1',
        label: 'Discrimination',
        value: 'I was harassed because of my age during team meetings.',
        confidence: 0.77,
        userConfirmed: true,
      },
    ];
    const trace = buildAxiomTrace('case-2', facts, 'england_wales');
    expect(trace.steps[1]?.summary).toContain('Equality Act 2010');
  });

  it('exposes ART system prompt bundle with statutory context', () => {
    const bundle = artEmploymentSystemBundle();
    expect(bundle.systemPrompt.length).toBeGreaterThan(40);
    expect(bundle.anchors).toContain('Employment Rights Act 1996');
  });
});

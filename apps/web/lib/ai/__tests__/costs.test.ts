import { getMonthlyAiCostSummary, logAiCall, resetAiCostLogs } from '../costs';

describe('costs', () => {
  beforeEach(() => {
    resetAiCostLogs();
  });

  it('aggregates logged calls', () => {
    logAiCall({
      model: 'gemini-flash',
      questionType: 'answer_simple',
      estCostGbp: 0.00018,
    });
    logAiCall({
      model: 'claude-sonnet',
      questionType: 'answer_complex',
      estCostGbp: 0.0056,
    });

    const summary = getMonthlyAiCostSummary();
    expect(summary.calls).toBe(2);
    expect(summary.totalEstGbp).toBeGreaterThan(0);
    expect(summary.byModel['gemini-flash']).toBeGreaterThan(0);
  });
});

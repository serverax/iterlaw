import { generateCaseSummaryPdf } from '../case-summary-pdf';

describe('Case Summary PDF', () => {
  it('should generate PDF buffer', async () => {
    const buf = await generateCaseSummaryPdf({
      caseId: 'case-1',
      userId: 'user-1',
      jurisdiction: 'England and Wales',
      timeline: [{ date: '2026-01-01', event: 'Dismissed' }],
      questions: [{ id: 'q1', text: 'Was dismissal fair?', source: 'gov_api' }],
    });
    expect(buf.length).toBeGreaterThan(100);
  });
});

import { triggerDocumentLifecycleCleanup, scheduleDocumentImageDeletion } from '../src/services/document-lifecycle';
import { calculateUserTier, getTierInfo } from '../src/services/loyalty-engine';
import { purgeExpiredCacheEntries, setMemoryCacheExpiry } from '../src/services/qa-cache-expiry';
import { generateCaseSummaryPdf } from '../src/services/case-summary-pdf';
import { analyzeEmploymentDocument } from '../src/services/ocr-service';

describe('Blockers integration', () => {
  it('document lifecycle cleanup', async () => {
    scheduleDocumentImageDeletion('d1', async () => undefined, new Date(Date.now() - 25 * 60 * 60 * 1000));
    const n = await triggerDocumentLifecycleCleanup();
    expect(n).toBeGreaterThanOrEqual(1);
  });

  it('loyalty tiers', () => {
    expect(calculateUserTier(4000)).toBe('champion');
    expect(getTierInfo('informed').discountPercent).toBe(10);
  });

  it('qa cache expiry memory', () => {
    setMemoryCacheExpiry('qa1', new Date(Date.now() - 1000));
    expect(purgeExpiredCacheEntries()).toBeGreaterThanOrEqual(1);
  });

  it('case summary pdf', async () => {
    const buf = await generateCaseSummaryPdf({
      caseId: 'c1',
      userId: 'u1',
      jurisdiction: 'EW',
      timeline: [],
      questions: [{ id: 'q1', text: 'test' }],
    });
    expect(buf.length).toBeGreaterThan(50);
  });

  it('ocr stub', async () => {
    const r = await analyzeEmploymentDocument(Buffer.from('dismissal letter'));
    expect(r.fullText.length).toBeGreaterThan(0);
  });
});

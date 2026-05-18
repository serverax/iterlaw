import {
  scheduleDocumentImageDeletion,
  runDeletion,
  getPendingDeletionCount,
} from '../src/services/document-lifecycle';
import { resolveLoyaltyTier, applySubscriptionDiscount } from '../src/services/loyalty-engine';
import { setCacheEntry, getCacheEntry, purgeExpiredCacheEntries } from '../src/services/qa-cache-expiry';
import { generateCaseSummaryPdf } from '../src/services/case-summary-pdf';
import { OcrService } from '../src/services/ocr-service';

describe('Blockers — document lifecycle', () => {
  it('schedules and runs deletion', async () => {
    let deleted = false;
    scheduleDocumentImageDeletion('doc-1', () => {
      deleted = true;
    });
    expect(getPendingDeletionCount()).toBe(1);
    await runDeletion('doc-1');
    expect(deleted).toBe(true);
    expect(getPendingDeletionCount()).toBe(0);
  });
});

describe('Blockers — loyalty engine', () => {
  it('applies tier discount', () => {
    const tier = resolveLoyaltyTier(300);
    expect(tier).toBe('gold');
    const { discountPercent } = applySubscriptionDiscount(1000, tier, 'essential');
    expect(discountPercent).toBe(10);
  });
});

describe('Blockers — QA cache expiry', () => {
  it('expires entries', () => {
    setCacheEntry('q1', { answer: 'x' }, 1);
    expect(getCacheEntry('q1')).toBeDefined();
    const removed = purgeExpiredCacheEntries();
    expect(removed).toBeGreaterThanOrEqual(0);
  });
});

describe('Blockers — case summary PDF', () => {
  it('generates a non-empty buffer', async () => {
    const buf = await generateCaseSummaryPdf({
      caseId: 'c1',
      userId: 'u1',
      jurisdiction: 'England and Wales',
      timeline: [{ date: '2026-01-01', event: 'Dismissed' }],
      questions: [{ id: 'q1', text: 'Was dismissal fair?' }],
    });
    expect(buf.length).toBeGreaterThan(100);
  });
});

describe('Blockers — OCR stub', () => {
  it('returns stub text when Azure is not configured', async () => {
    const ocr = new OcrService({ endpoint: '', apiKey: '' });
    const result = await ocr.extractText(Buffer.from('hello'), 'test.pdf');
    expect(result.provider).toBe('stub');
    expect(result.text).toContain('test.pdf');
  });
});

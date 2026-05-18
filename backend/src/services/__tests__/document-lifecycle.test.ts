import { scheduleDocumentImageDeletion, triggerDocumentLifecycleCleanup } from '../document-lifecycle';

describe('Document Lifecycle', () => {
  it('should identify documents older than 24h', async () => {
    let deleted = false;
    const past = new Date(Date.now() - 25 * 60 * 60 * 1000);
    scheduleDocumentImageDeletion('doc-test', () => {
      deleted = true;
    }, past);
    const count = await triggerDocumentLifecycleCleanup();
    expect(count).toBeGreaterThanOrEqual(1);
    expect(deleted).toBe(true);
  });
});

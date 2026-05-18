import { initializeDocumentLifecycle } from './services/document-lifecycle';
import { scheduleQACacheExpiry } from './services/qa-cache-expiry';
import { Logger } from './utils/logger';

const logger = new Logger('Bootstrap');
let started = false;

export function startBackgroundJobs(): void {
  if (started) return;
  started = true;
  initializeDocumentLifecycle();
  scheduleQACacheExpiry();
  logger.info('Background jobs started (document lifecycle + QA cache expiry)');
}

import { startDocumentLifecycleSweep } from './services/document-lifecycle';
import { startQaCacheExpirySweep } from './services/qa-cache-expiry';

let started = false;

/** Background jobs for document retention and QA cache expiry. */
export function startBackgroundJobs(): void {
  if (started) return;
  started = true;
  startDocumentLifecycleSweep();
  startQaCacheExpirySweep();
}

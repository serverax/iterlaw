import { LegalReviewError } from '@rightsnow/shared';
import type { HttpResponseInit } from '@azure/functions';
import { ZodError } from 'zod';

export function mapErrorToHttpResponse(err: unknown): HttpResponseInit {
  if (err instanceof ZodError) {
    return { status: 400, jsonBody: { ok: false, error: { code: 'VALIDATION', message: err.flatten() } } };
  }
  if (err instanceof LegalReviewError) {
    const status =
      err.code === 'QUEUE_NOT_FOUND' || err.code === 'POOL_ENTRY_NOT_FOUND'
        ? 404
        : err.code === 'QUEUE_TERMINAL' || err.code === 'ALREADY_QUEUED'
          ? 409
          : err.code === 'VALIDATION'
            ? 400
            : 500;
    return { status, jsonBody: { ok: false, error: { code: err.code, message: err.message } } };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { status: 500, jsonBody: { ok: false, error: { code: 'INTERNAL', message } } };
}

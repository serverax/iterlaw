import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { LegalReviewError } from '../types/legalReview';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

function legalReviewStatus(code: LegalReviewError['code']): number {
  switch (code) {
    case 'QUEUE_NOT_FOUND':
      return 404;
    case 'QUEUE_TERMINAL':
      return 409;
    case 'ENTRY_MISMATCH':
      return 400;
    case 'VALIDATION':
      return 400;
    default:
      return 500;
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof LegalReviewError) {
    res.status(legalReviewStatus(err.code)).json({
      ok: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      ok: false,
      error: { code: 'VALIDATION', message: JSON.stringify(err.flatten()) },
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({
      ok: false,
      error: { code: 'HTTP_ERROR', message: err.message },
    });
    return;
  }
  console.error(err);
  res.status(500).json({
    ok: false,
    error: { code: 'INTERNAL', message: 'Internal server error' },
  });
};

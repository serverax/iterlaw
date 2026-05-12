/**
 * Wire-level contracts for the IterLaw HTTP API (web + mobile clients).
 * Legal evaluation and AI orchestration live only on the backend.
 */

import { z } from 'zod';

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const apiErrorEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;

/** Base URL for the Express API (set in web/mobile env, never embed AI keys). */
export const apiConfigSchema = z.object({
  baseUrl: z.string().url(),
});

export type ApiClientConfig = z.infer<typeof apiConfigSchema>;

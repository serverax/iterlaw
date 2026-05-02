/**
 * Wire-level contracts for the RightsNow HTTP API (web + mobile clients).
 * Legal evaluation and AI orchestration live only on the backend.
 */
import { z } from 'zod';
export declare const healthResponseSchema: z.ZodObject<{
    ok: z.ZodLiteral<true>;
    service: z.ZodString;
}, "strip", z.ZodTypeAny, {
    ok: true;
    service: string;
}, {
    ok: true;
    service: string;
}>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export declare const apiErrorEnvelopeSchema: z.ZodObject<{
    ok: z.ZodLiteral<false>;
    error: z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
    }, {
        code: string;
        message: string;
    }>;
}, "strip", z.ZodTypeAny, {
    ok: false;
    error: {
        code: string;
        message: string;
    };
}, {
    ok: false;
    error: {
        code: string;
        message: string;
    };
}>;
export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;
/** Base URL for the Express API (set in web/mobile env, never embed AI keys). */
export declare const apiConfigSchema: z.ZodObject<{
    baseUrl: z.ZodString;
}, "strip", z.ZodTypeAny, {
    baseUrl: string;
}, {
    baseUrl: string;
}>;
export type ApiClientConfig = z.infer<typeof apiConfigSchema>;
//# sourceMappingURL=api-contracts.d.ts.map
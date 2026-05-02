"use strict";
/**
 * Wire-level contracts for the RightsNow HTTP API (web + mobile clients).
 * Legal evaluation and AI orchestration live only on the backend.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiConfigSchema = exports.apiErrorEnvelopeSchema = exports.healthResponseSchema = void 0;
const zod_1 = require("zod");
exports.healthResponseSchema = zod_1.z.object({
    ok: zod_1.z.literal(true),
    service: zod_1.z.string(),
});
exports.apiErrorEnvelopeSchema = zod_1.z.object({
    ok: zod_1.z.literal(false),
    error: zod_1.z.object({
        code: zod_1.z.string(),
        message: zod_1.z.string(),
    }),
});
/** Base URL for the Express API (set in web/mobile env, never embed AI keys). */
exports.apiConfigSchema = zod_1.z.object({
    baseUrl: zod_1.z.string().url(),
});

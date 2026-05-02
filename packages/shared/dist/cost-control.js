"use strict";
/**
 * MVP cost-control flags and model policy (server-side).
 * Defaults match IterLaw MVP; override via environment variables.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayloadTooLargeError = exports.PremiumModelBlockedError = exports.DEFAULT_CHEAP_AI_MODEL = void 0;
exports.isCheapModel = isCheapModel;
exports.isPremiumModelRequest = isPremiumModelRequest;
exports.canUsePremiumModel = canUsePremiumModel;
exports.assertPremiumModelAllowed = assertPremiumModelAllowed;
exports.dailyAiLimitForRole = dailyAiLimitForRole;
exports.utf8ByteLength = utf8ByteLength;
exports.assertPayloadUnderMaxUpload = assertPayloadUnderMaxUpload;
exports.loadCostControlFromEnv = loadCostControlFromEnv;
exports.DEFAULT_CHEAP_AI_MODEL = 'google/gemini-2.0-flash-001';
class PremiumModelBlockedError extends Error {
    code = 'PREMIUM_MODEL_NOT_ALLOWED';
    constructor(message = 'Premium model is not allowed for this caller') {
        super(message);
        this.name = 'PremiumModelBlockedError';
    }
}
exports.PremiumModelBlockedError = PremiumModelBlockedError;
class PayloadTooLargeError extends Error {
    code = 'PAYLOAD_TOO_LARGE';
    constructor(message = 'Request body exceeds MAX_UPLOAD_MB') {
        super(message);
        this.name = 'PayloadTooLargeError';
    }
}
exports.PayloadTooLargeError = PayloadTooLargeError;
function parseBool(v, defaultValue) {
    if (v === undefined || v.trim() === '')
        return defaultValue;
    const s = v.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(s))
        return true;
    if (['0', 'false', 'no', 'off'].includes(s))
        return false;
    return defaultValue;
}
function parseIntEnv(v, defaultValue, min = 0) {
    if (v === undefined || v.trim() === '')
        return defaultValue;
    const n = Number.parseInt(v, 10);
    if (!Number.isFinite(n) || n < min)
        return defaultValue;
    return n;
}
function normalizeModelId(id) {
    return id.trim().toLowerCase();
}
/** Aliases treated as the cheap default (direct Gemini API vs OpenRouter naming). */
const CHEAP_MODEL_ALIASES = new Set([
    exports.DEFAULT_CHEAP_AI_MODEL,
    'google/gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
].map((s) => normalizeModelId(s)));
function isCheapModel(modelId, defaultCheap) {
    if (modelId === undefined || modelId.trim() === '')
        return true;
    const n = normalizeModelId(modelId);
    if (n === normalizeModelId(defaultCheap))
        return true;
    return CHEAP_MODEL_ALIASES.has(n);
}
function isPremiumModelRequest(modelId, defaultCheap) {
    if (modelId === undefined || modelId.trim() === '')
        return false;
    return !isCheapModel(modelId, defaultCheap);
}
/**
 * When PREMIUM_MODEL_REQUIRES_ADMIN=true: premium allowed only for admin or legal-reviewer escalation.
 * When false: registered users may also request premium (still not anonymous/free unless you extend this).
 */
function canUsePremiumModel(opts) {
    if (opts.reviewerEscalatedPremium)
        return true;
    if (opts.callerRole === 'admin')
        return true;
    if (!opts.premiumModelRequiresAdmin && opts.callerRole === 'registered')
        return true;
    return false;
}
function assertPremiumModelAllowed(opts) {
    if (!isPremiumModelRequest(opts.requestedModel, opts.config.defaultCheapModel))
        return;
    if (canUsePremiumModel({
        premiumModelRequiresAdmin: opts.config.premiumModelRequiresAdmin,
        callerRole: opts.callerRole,
        reviewerEscalatedPremium: opts.reviewerEscalatedPremium,
    })) {
        return;
    }
    throw new PremiumModelBlockedError();
}
function dailyAiLimitForRole(role, config) {
    switch (role) {
        case 'admin':
            return config.adminDailyAiLimit;
        case 'registered':
            return config.registeredUserDailyAiLimit;
        default:
            return config.freeUserDailyAiLimit;
    }
}
function utf8ByteLength(questionText, documentText) {
    const enc = new TextEncoder();
    return enc.encode(questionText).length + enc.encode(documentText ?? '').length;
}
function assertPayloadUnderMaxUpload(opts) {
    const bytes = utf8ByteLength(opts.questionText, opts.documentText);
    const maxBytes = opts.maxUploadMb * 1024 * 1024;
    if (bytes > maxBytes) {
        throw new PayloadTooLargeError(`Payload is ${Math.ceil(bytes / 1024)} KB; limit is ${opts.maxUploadMb} MB`);
    }
}
function loadCostControlFromEnv(env = process.env) {
    const defaultCheap = (env.DEFAULT_AI_MODEL ?? env.CHEAP_AI_MODEL ?? exports.DEFAULT_CHEAP_AI_MODEL).trim() || exports.DEFAULT_CHEAP_AI_MODEL;
    return {
        freeUserDailyAiLimit: parseIntEnv(env.FREE_USER_DAILY_AI_LIMIT, 3, 0),
        registeredUserDailyAiLimit: parseIntEnv(env.REGISTERED_USER_DAILY_AI_LIMIT, 10, 0),
        adminDailyAiLimit: parseIntEnv(env.ADMIN_DAILY_AI_LIMIT, 50, 0),
        maxUploadMb: parseIntEnv(env.MAX_UPLOAD_MB, 5, 1),
        enableBackgroundPolling: parseBool(env.ENABLE_BACKGROUND_POLLING, false),
        autoRunAi: parseBool(env.AUTO_RUN_AI, false),
        premiumModelRequiresAdmin: parseBool(env.PREMIUM_MODEL_REQUIRES_ADMIN, true),
        cacheRepeatedQuestions: parseBool(env.CACHE_REPEATED_QUESTIONS, true),
        logEstimatedAiCost: parseBool(env.LOG_ESTIMATED_AI_COST, true),
        defaultCheapModel: defaultCheap,
    };
}

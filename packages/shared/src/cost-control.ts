/**
 * MVP cost-control flags and model policy (server-side).
 * Defaults match IterLaw MVP; override via environment variables.
 */

export const DEFAULT_CHEAP_AI_MODEL = 'google/gemini-2.0-flash-001';

export type CallerRole = 'free' | 'registered' | 'admin';

export type CostControlConfig = {
  freeUserDailyAiLimit: number;
  registeredUserDailyAiLimit: number;
  adminDailyAiLimit: number;
  maxUploadMb: number;
  enableBackgroundPolling: boolean;
  autoRunAi: boolean;
  premiumModelRequiresAdmin: boolean;
  cacheRepeatedQuestions: boolean;
  logEstimatedAiCost: boolean;
  /** Effective default / cheap-tier model id (OpenRouter-style or Gemini id). */
  defaultCheapModel: string;
};

export class PremiumModelBlockedError extends Error {
  readonly code = 'PREMIUM_MODEL_NOT_ALLOWED' as const;
  constructor(message = 'Premium model is not allowed for this caller') {
    super(message);
    this.name = 'PremiumModelBlockedError';
  }
}

export class PayloadTooLargeError extends Error {
  readonly code = 'PAYLOAD_TOO_LARGE' as const;
  constructor(message = 'Request body exceeds MAX_UPLOAD_MB') {
    super(message);
    this.name = 'PayloadTooLargeError';
  }
}

function parseBool(v: string | undefined, defaultValue: boolean): boolean {
  if (v === undefined || v.trim() === '') return defaultValue;
  const s = v.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'off'].includes(s)) return false;
  return defaultValue;
}

function parseIntEnv(v: string | undefined, defaultValue: number, min = 0): number {
  if (v === undefined || v.trim() === '') return defaultValue;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < min) return defaultValue;
  return n;
}

function normalizeModelId(id: string): string {
  return id.trim().toLowerCase();
}

/** Aliases treated as the cheap default (direct Gemini API vs OpenRouter naming). */
const CHEAP_MODEL_ALIASES = new Set(
  [
    DEFAULT_CHEAP_AI_MODEL,
    'google/gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
  ].map((s) => normalizeModelId(s)),
);

export function isCheapModel(modelId: string | undefined, defaultCheap: string): boolean {
  if (modelId === undefined || modelId.trim() === '') return true;
  const n = normalizeModelId(modelId);
  if (n === normalizeModelId(defaultCheap)) return true;
  return CHEAP_MODEL_ALIASES.has(n);
}

export function isPremiumModelRequest(modelId: string | undefined, defaultCheap: string): boolean {
  if (modelId === undefined || modelId.trim() === '') return false;
  return !isCheapModel(modelId, defaultCheap);
}

/**
 * When PREMIUM_MODEL_REQUIRES_ADMIN=true: premium allowed only for admin or legal-reviewer escalation.
 * When false: registered users may also request premium (still not anonymous/free unless you extend this).
 */
export function canUsePremiumModel(opts: {
  premiumModelRequiresAdmin: boolean;
  callerRole: CallerRole;
  reviewerEscalatedPremium: boolean;
}): boolean {
  if (opts.reviewerEscalatedPremium) return true;
  if (opts.callerRole === 'admin') return true;
  if (!opts.premiumModelRequiresAdmin && opts.callerRole === 'registered') return true;
  return false;
}

export function assertPremiumModelAllowed(opts: {
  config: CostControlConfig;
  requestedModel: string | undefined;
  callerRole: CallerRole;
  reviewerEscalatedPremium: boolean;
}): void {
  if (!isPremiumModelRequest(opts.requestedModel, opts.config.defaultCheapModel)) return;
  if (
    canUsePremiumModel({
      premiumModelRequiresAdmin: opts.config.premiumModelRequiresAdmin,
      callerRole: opts.callerRole,
      reviewerEscalatedPremium: opts.reviewerEscalatedPremium,
    })
  ) {
    return;
  }
  throw new PremiumModelBlockedError();
}

export function dailyAiLimitForRole(role: CallerRole, config: CostControlConfig): number {
  switch (role) {
    case 'admin':
      return config.adminDailyAiLimit;
    case 'registered':
      return config.registeredUserDailyAiLimit;
    default:
      return config.freeUserDailyAiLimit;
  }
}

export function utf8ByteLength(questionText: string, documentText?: string): number {
  const enc = new TextEncoder();
  return enc.encode(questionText).length + enc.encode(documentText ?? '').length;
}

export function assertPayloadUnderMaxUpload(opts: {
  questionText: string;
  documentText?: string;
  maxUploadMb: number;
}): void {
  const bytes = utf8ByteLength(opts.questionText, opts.documentText);
  const maxBytes = opts.maxUploadMb * 1024 * 1024;
  if (bytes > maxBytes) {
    throw new PayloadTooLargeError(
      `Payload is ${Math.ceil(bytes / 1024)} KB; limit is ${opts.maxUploadMb} MB`,
    );
  }
}

export function loadCostControlFromEnv(env: NodeJS.ProcessEnv = process.env): CostControlConfig {
  const defaultCheap =
    (env.DEFAULT_AI_MODEL ?? env.CHEAP_AI_MODEL ?? DEFAULT_CHEAP_AI_MODEL).trim() || DEFAULT_CHEAP_AI_MODEL;

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

export type ArtRuntimeOptions = {
  resolvedModel: string;
  autoRunAi: boolean;
  logEstimatedAiCost: boolean;
};

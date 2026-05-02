/**
 * MVP cost-control flags and model policy (server-side).
 * Defaults match IterLaw MVP; override via environment variables.
 */
export declare const DEFAULT_CHEAP_AI_MODEL = "google/gemini-2.0-flash-001";
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
export declare class PremiumModelBlockedError extends Error {
    readonly code: "PREMIUM_MODEL_NOT_ALLOWED";
    constructor(message?: string);
}
export declare class PayloadTooLargeError extends Error {
    readonly code: "PAYLOAD_TOO_LARGE";
    constructor(message?: string);
}
export declare function isCheapModel(modelId: string | undefined, defaultCheap: string): boolean;
export declare function isPremiumModelRequest(modelId: string | undefined, defaultCheap: string): boolean;
/**
 * When PREMIUM_MODEL_REQUIRES_ADMIN=true: premium allowed only for admin or legal-reviewer escalation.
 * When false: registered users may also request premium (still not anonymous/free unless you extend this).
 */
export declare function canUsePremiumModel(opts: {
    premiumModelRequiresAdmin: boolean;
    callerRole: CallerRole;
    reviewerEscalatedPremium: boolean;
}): boolean;
export declare function assertPremiumModelAllowed(opts: {
    config: CostControlConfig;
    requestedModel: string | undefined;
    callerRole: CallerRole;
    reviewerEscalatedPremium: boolean;
}): void;
export declare function dailyAiLimitForRole(role: CallerRole, config: CostControlConfig): number;
export declare function utf8ByteLength(questionText: string, documentText?: string): number;
export declare function assertPayloadUnderMaxUpload(opts: {
    questionText: string;
    documentText?: string;
    maxUploadMb: number;
}): void;
export declare function loadCostControlFromEnv(env?: NodeJS.ProcessEnv): CostControlConfig;
export type ArtRuntimeOptions = {
    resolvedModel: string;
    autoRunAi: boolean;
    logEstimatedAiCost: boolean;
};
//# sourceMappingURL=cost-control.d.ts.map
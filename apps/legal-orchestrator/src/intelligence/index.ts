// intelligence/ — Fast Legal Answer Engine + Sprint 14 Intelligence Layer surface.

// Pre-existing Fast Legal Answer Engine exports.
export { planFastLegalAnswer } from "./fastAnswerPlanner";
export type {
  FastAnswerInput,
  FastAnswerMode,
  FastAnswerResult,
  LegalAnswerBlock,
  LegalLlmJob,
  LegalLlmOutput,
  LegalResponseCacheEntry,
  ModelRoutingDecision,
  MotherBrainDecision,
} from "./fastAnswer.types";

// Sprint 14 Intelligence Layer exports.
export * from "./intelligence.types";
export { classifyQuery } from "./queryClassifier";
export { planRetrieval } from "./retrievalPlanner";
export { rrfFuse, RRF_K } from "./rrfFusion";
export { hybridRetrieve } from "./hybridRetriever";
export { scoreCandidates } from "./trustScorer";
export {
  assessFreshness,
  filterFreshForLegalAnswer,
} from "./freshnessFilter";
export { compressEvidence } from "./contextCompressor";
export {
  buildCacheKey,
  cacheKeyEquals,
  hashEvidencePack,
  normalizeQuestion,
  INVALIDATORS,
  type CacheInvalidator,
} from "./semanticCache";
export { evaluateRag } from "./ragEvaluator";
export { runIntelligenceGateway } from "./intelligenceGateway";

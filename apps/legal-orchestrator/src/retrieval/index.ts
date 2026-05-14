// Sprint 19 — Multi-tier retrieval public surface.

export type {
  MetadataFilter,
  MultiTierPlan,
  MultiTierResult,
  RetrievalQueryType,
  RetrievalTierStatus,
  TierName,
  TierResult,
  ExactApprovedHit,
  RulesLookupHit,
} from "./retrieval.types";

export { applyMetadataFilter } from "./metadataFilter";
export { applyTrustFilter } from "./retrievalTrustFilter";
export type { TrustFilterOutcome } from "./retrievalTrustFilter";
export { applyFreshnessFilter } from "./retrievalFreshnessFilter";
export type { FreshnessFilterOutcome } from "./retrievalFreshnessFilter";
export { fuseRrf } from "./rrfFusion";
export type { RrfFusionResult } from "./rrfFusion";
export { runExactMatchTier } from "./exactMatchTier";
export type { ExactApprovedLookup } from "./exactMatchTier";
export { runRulesLookupTier } from "./rulesLookupTier";
export type { RulesLookup } from "./rulesLookupTier";
export { runFullTextTier } from "./fullTextTier";
export type { FullTextSearch } from "./fullTextTier";
export { runVectorTier } from "./vectorTier";
export type { VectorSearch } from "./vectorTier";
export { buildContextPack } from "./contextPackBuilder";
export type { ContextPack, ContextPackEntry } from "./contextPackBuilder";
export { planAndExecuteMultiTier } from "./retrievalPlanner";
export type { PlannerRequest, PlannerDependencies } from "./retrievalPlanner";
export { runMultiTierRetrievalGateway } from "./multiTierRetrievalGateway";
export type {
  MultiTierRetrievalGatewayInput,
  MultiTierRetrievalGatewayResult,
} from "./multiTierRetrievalGateway";

// Sprint 19B — Postgres retrieval adapters
export {
  createPostgresFullTextSearch,
  createPostgresVectorSearch,
  createPostgresRetrievalAdapters,
} from "./postgresRetrievalAdapters";
export type { PostgresAdapterOptions } from "./postgresRetrievalAdapters";

// Sprint 23 — Deterministic reranker
export { rerankCandidates, DEFAULT_RERANKER_WEIGHTS } from "./reranker";
export type {
  RerankerWeights,
  RerankerContext,
  RerankerScore,
  RerankerOutcome,
} from "./reranker";

// Sprint 26 — Approved-answer fast path
export { buildRetrievalCacheKey, normaliseQuestion } from "./retrievalCacheKey";
export type { RetrievalCacheKeyInput } from "./retrievalCacheKey";
export { runApprovedAnswerFastPath } from "./approvedAnswerFastPath";
export type {
  ApprovedAnswerEntry,
  ApprovedAnswerLookup,
  ApprovedAnswerFastPathInput,
  ApprovedAnswerFastPathOutcome,
} from "./approvedAnswerFastPath";

// Sprint 27 — Approved-answer fast path gateway (wiring adapter)
export { runApprovedAnswerFastPathGateway } from "./approvedAnswerFastPathGateway";
export type {
  ApprovedAnswerFastPathGatewayInput,
  ApprovedAnswerFastPathGatewayResult,
} from "./approvedAnswerFastPathGateway";

// Sprint 32 — pgvector VectorSearch adapter
export { createPgvectorSearch, createPgvectorSearchFromEmbedder } from "./pgvectorSearchAdapter";
export type {
  PgvectorClient,
  PgvectorRow,
  PgvectorSearchOptions,
  PgvectorAdapterOptions,
  QuestionToEmbedding,
} from "./pgvectorSearchAdapter";

// Sprint 39 — Approved-answer Tier-0 store
export { buildApprovedAnswerKey, InMemoryApprovedAnswerStore } from "./approvedAnswerStore";
export type {
  ApprovedAnswerStore,
  ApprovedAnswerStoreKeyInput,
  ApprovedAnswerStorePutOutcome,
  InMemoryApprovedAnswerStoreOptions,
} from "./approvedAnswerStore";

// Sprint 41 — Local embedder for vectorSearch bridge
export { computeLocalEmbedding, createLocalEmbedderForVectorSearch } from "./localEmbedder";
export type {
  LocalEmbedderTransport,
  LocalEmbedderOptions,
  LocalEmbedderOutcome,
} from "./localEmbedder";

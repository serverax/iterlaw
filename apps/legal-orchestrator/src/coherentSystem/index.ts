export * from "./lawEngineBand.js";
export * from "./rerankerV2.js";
export * from "./retrievalBand.js";
export * from "./zone2RetrievalTypes.js";
export * from "./zone2RetrievalStub.js";
export * from "./retrievalHNSWPhase1.js";
export * from "./retrievalOllamaPhase2.js";
export * from "./retrievalStreamingPhase3.js";
export * from "./retrievalSpeculativePhase4.js";
export * from "./retrievalLatencySLAPhase5.js";
export * from "./retrievalQueryOptPhase6.js";
export * from "./retrievalBatchPhase7.js";
export * from "./retrievalCacheInvalidationPhase8.js";
export * from "./retrievalFallbackPhase9.js";
export * from "./wasmBand.js";
export * from "./zone2WasmTypes.js";
export * from "./zone2WasmStub.js";
export * from "./wasmSandboxPhase1.js";
export * from "./wasmProofVerificationPhase2.js";
export * from "./wasmClientProofPhase3.js";
export * from "./wasmSignedPackagePhase4.js";
export * from "./wasmMemoryEnforcementPhase5.js";
export * from "./wasmMerkleCommitmentPhase6.js";
export * from "./wasmZkpVerificationPhase7.js";
export * from "./wasmLedgerIntegrationPhase8.js";
export * from "./wasmAggregationPhase9.js";
export * from "./wasmDisputeResolutionPhase10.js";
export * from "./zone2WorkspaceTypes.js";
export * from "./zone2WorkspaceStub.js";
export * from "./workspaceIsolationPhase1.js";
export * from "./temporalRlsPhase2.js";
export * from "./auditTrailLoggingPhase3.js";
export * from "./workspaceRbacPhase4.js";
export * from "./crossWorkspaceRestrictionsPhase5.js";
export * from "./workspaceSettingsPhase6.js";
export * from "./workspaceTemporalBand.js";
export * from "./documentIntelBand.js";
export * from "./zone2DocumentTypes.js";
export * from "./zone2DocumentStub.js";
export * from "./documentUploadOcrPhase51.js";
export * from "./entityExtractionPhase52.js";
export * from "./legalDocumentParsingPhase53.js";
export * from "./documentClassificationPhase54.js";
export * from "./semanticChunkingPhase55.js";
export * from "./semanticSearchPhase56.js";
export * from "./citationLockedAnswerPhase57.js";
export * from "./documentIntelIntegrationPhase58.js";
export * from "./zone2LawTypes.js";
export * from "./zone2LawStub.js";
export * from "./lawEnginePhase2.js";
export * from "./lawEnginePhase3.js";
export * from "./lawEnginePhase4.js";
export * from "./lawEnginePhase5.js";

import { Zone2LawServiceStub } from "./zone2LawStub.js";
import { Zone2RetrievalServiceStub } from "./zone2RetrievalStub.js";
import { LawEnginePhase2Band } from "./lawEnginePhase2.js";
import { LawEnginePhase3Band } from "./lawEnginePhase3.js";
import { LawEnginePhase4Band } from "./lawEnginePhase4.js";
import { LawEnginePhase5Band } from "./lawEnginePhase5.js";
import { RetrievalHNSWPhase1Band } from "./retrievalHNSWPhase1.js";
import { RetrievalOllamaPhase2Band } from "./retrievalOllamaPhase2.js";
import { RetrievalStreamingPhase3Band } from "./retrievalStreamingPhase3.js";
import { RetrievalSpeculativePhase4Band } from "./retrievalSpeculativePhase4.js";
import { RetrievalLatencySLAPhase5Band } from "./retrievalLatencySLAPhase5.js";
import { RetrievalQueryOptPhase6Band } from "./retrievalQueryOptPhase6.js";
import { RetrievalBatchPhase7Band } from "./retrievalBatchPhase7.js";
import { RetrievalCacheInvalidationPhase8Band } from "./retrievalCacheInvalidationPhase8.js";
import { RetrievalFallbackPhase9Band } from "./retrievalFallbackPhase9.js";
import { Zone2WasmServiceStub } from "./zone2WasmStub.js";
import { WasmSandboxPhase1Band } from "./wasmSandboxPhase1.js";
import { WasmProofVerificationPhase2Band } from "./wasmProofVerificationPhase2.js";
import { WasmClientProofPhase3Band } from "./wasmClientProofPhase3.js";
import { WasmSignedPackagePhase4Band } from "./wasmSignedPackagePhase4.js";
import { WasmMemoryEnforcementPhase5Band } from "./wasmMemoryEnforcementPhase5.js";
import { WasmMerkleCommitmentPhase6Band } from "./wasmMerkleCommitmentPhase6.js";
import { WasmZkpVerificationPhase7Band } from "./wasmZkpVerificationPhase7.js";
import { WasmLedgerIntegrationPhase8Band } from "./wasmLedgerIntegrationPhase8.js";
import { WasmAggregationPhase9Band } from "./wasmAggregationPhase9.js";
import { WasmDisputeResolutionPhase10Band } from "./wasmDisputeResolutionPhase10.js";
import { createZone2DocumentService } from "./azureDocumentIntelligenceZone2.js";
import { DocumentUploadOcrPhase51Band } from "./documentUploadOcrPhase51.js";
import { EntityExtractionPhase52Band } from "./entityExtractionPhase52.js";
import { LegalDocumentParsingPhase53Band } from "./legalDocumentParsingPhase53.js";
import { DocumentClassificationPhase54Band } from "./documentClassificationPhase54.js";
import { SemanticChunkingPhase55Band } from "./semanticChunkingPhase55.js";
import { SemanticSearchPhase56Band } from "./semanticSearchPhase56.js";
import { CitationLockedAnswerPhase57Band } from "./citationLockedAnswerPhase57.js";
import { DocumentIntelIntegrationPhase58Band } from "./documentIntelIntegrationPhase58.js";
import { Zone2WorkspaceServiceStub } from "./zone2WorkspaceStub.js";
import { WorkspaceIsolationPhase1Band } from "./workspaceIsolationPhase1.js";
import { TemporalRlsPhase2Band } from "./temporalRlsPhase2.js";
import { AuditTrailLoggingPhase3Band } from "./auditTrailLoggingPhase3.js";
import { WorkspaceRbacPhase4Band } from "./workspaceRbacPhase4.js";
import { CrossWorkspaceRestrictionsPhase5Band } from "./crossWorkspaceRestrictionsPhase5.js";
import { WorkspaceSettingsPhase6Band } from "./workspaceSettingsPhase6.js";

const zone2Retrieval = new Zone2RetrievalServiceStub();
const retrievalOllamaPhase2BandInstance = new RetrievalOllamaPhase2Band(zone2Retrieval);

/** Default Phase 2 band wired to the Zone 2 stub (swap for real Zone2LawService later). */
export const lawEnginePhase2Band = new LawEnginePhase2Band(new Zone2LawServiceStub());

/** Default Phase 3 band (Phase 2 + refinement stub). */
export const lawEnginePhase3Band = new LawEnginePhase3Band(new Zone2LawServiceStub());

/** Default Phase 4 band (Phase 3 + compliance checklist stub). */
export const lawEnginePhase4Band = new LawEnginePhase4Band(new Zone2LawServiceStub());

/** Default Phase 5 band (Phase 4 + engagement pack finalization stub). */
export const lawEnginePhase5Band = new LawEnginePhase5Band(new Zone2LawServiceStub());

/** Sprint 26 — HNSW Phase 1 (Zone 2 retrieval stub for remote index hints). */
export const retrievalHnswPhase1Band = new RetrievalHNSWPhase1Band(zone2Retrieval);

/** Sprint 27 — Ollama inference cache TTL merge (Zone 2 retrieval stub). */
export const retrievalOllamaPhase2Band = retrievalOllamaPhase2BandInstance;

/** Sprint 28 — Streaming chunks + Phase 2 TTL context. */
export const retrievalStreamingPhase3Band = new RetrievalStreamingPhase3Band(
  zone2Retrieval,
  retrievalOllamaPhase2BandInstance,
);

/** Sprint 29 — Speculative draft/verify + Phases 2–3 context. */
export const retrievalSpeculativePhase4Band = new RetrievalSpeculativePhase4Band(
  zone2Retrieval,
  retrievalOllamaPhase2BandInstance,
  retrievalStreamingPhase3Band,
);

/** Sprint 30 — Latency percentiles + SLA compliance vs Zone 2 budget. */
export const retrievalLatencySLAPhase5Band = new RetrievalLatencySLAPhase5Band(zone2Retrieval);

/** Sprint 31 — Query plan fingerprint + index suggestions. */
export const retrievalQueryOptPhase6Band = new RetrievalQueryOptPhase6Band(zone2Retrieval);

/** Sprint 32 — Batch query jobs + remote batch stub. */
export const retrievalBatchPhase7Band = new RetrievalBatchPhase7Band(zone2Retrieval);

/** Sprint 33 — Cache invalidation rules + stale purge. */
export const retrievalCacheInvalidationPhase8Band = new RetrievalCacheInvalidationPhase8Band(zone2Retrieval);

/** Sprint 34 — Fallback chain HNSW → Ollama → BM25 → static FAQ. */
export const retrievalFallbackPhase9Band = new RetrievalFallbackPhase9Band(zone2Retrieval);

const zone2Wasm = new Zone2WasmServiceStub();

/** Sprint 35 — WASM sandbox (64 KiB memory ceiling). */
export const wasmSandboxPhase1Band = new WasmSandboxPhase1Band(zone2Wasm);

/** Sprint 36 — Deterministic WASM proof verification. */
export const wasmProofVerificationPhase2Band = new WasmProofVerificationPhase2Band(zone2Wasm);

/** Sprint 37 — Client-side proof generation + cache. */
export const wasmClientProofPhase3Band = new WasmClientProofPhase3Band(zone2Wasm);

/** Sprint 38 — Signed evidence packages (ECDSA/EdDSA stub). */
export const wasmSignedPackagePhase4Band = new WasmSignedPackagePhase4Band(zone2Wasm);

/** Sprint 39 — WASM memory enforcement + gas meter audit. */
export const wasmMemoryEnforcementPhase5Band = new WasmMemoryEnforcementPhase5Band(zone2Wasm);

/** Sprint 40 — Merkle evidence commitment trees. */
export const wasmMerkleCommitmentPhase6Band = new WasmMerkleCommitmentPhase6Band(zone2Wasm);

/** Sprint 41 — Zero-knowledge proof verification (Fiat-Shamir stub). */
export const wasmZkpVerificationPhase7Band = new WasmZkpVerificationPhase7Band(zone2Wasm);

/** Sprint 42 — Ledger sync for Merkle proof references. */
export const wasmLedgerIntegrationPhase8Band = new WasmLedgerIntegrationPhase8Band(zone2Wasm);

/** Sprint 43 — Proof aggregation and compression. */
export const wasmAggregationPhase9Band = new WasmAggregationPhase9Band(zone2Wasm);

/** Sprint 44 — Case-scoped dispute resolution. */
export const wasmDisputeResolutionPhase10Band = new WasmDisputeResolutionPhase10Band(zone2Wasm);

const zone2Workspace = new Zone2WorkspaceServiceStub();

/** Sprint 45 — Multi-tenant workspace foundation. */
export const workspaceIsolationPhase1Band = new WorkspaceIsolationPhase1Band(zone2Workspace);

/** Sprint 46 — Temporal workspace member roles. */
export const temporalRlsPhase2Band = new TemporalRlsPhase2Band(zone2Workspace);

/** Sprint 47 — Immutable workspace audit trail. */
export const auditTrailLoggingPhase3Band = new AuditTrailLoggingPhase3Band(zone2Workspace);

/** Sprint 48 — Workspace RBAC permission matrix. */
export const workspaceRbacPhase4Band = new WorkspaceRbacPhase4Band(zone2Workspace);

/** Sprint 49 — Cross-workspace isolation enforcement. */
export const crossWorkspaceRestrictionsPhase5Band = new CrossWorkspaceRestrictionsPhase5Band(zone2Workspace);

/** Sprint 50 — Workspace settings and defaults. */
export const workspaceSettingsPhase6Band = new WorkspaceSettingsPhase6Band(zone2Workspace);

const zone2Document = createZone2DocumentService();

/** Sprint 51 — Document upload + OCR (Azure DI or stub). */
export const documentUploadOcrPhase51Band = new DocumentUploadOcrPhase51Band(zone2Document);

/** Sprint 52 — Entity extraction. */
export const entityExtractionPhase52Band = new EntityExtractionPhase52Band();

/** Sprint 53 — Legal document parsing. */
export const legalDocumentParsingPhase53Band = new LegalDocumentParsingPhase53Band();

/** Sprint 54 — Document classification + metadata. */
export const documentClassificationPhase54Band = new DocumentClassificationPhase54Band();

/** Sprint 55 — Semantic chunking + embeddings stub. */
export const semanticChunkingPhase55Band = new SemanticChunkingPhase55Band(zone2Document);

/** Sprint 56 — Vector search / RAG retrieval. */
export const semanticSearchPhase56Band = new SemanticSearchPhase56Band();

/** Sprint 57 — Citation-locked answer synthesis. */
export const citationLockedAnswerPhase57Band = new CitationLockedAnswerPhase57Band(zone2Document);

/** Sprint 58 — Document intelligence pipeline integration. */
export const documentIntelIntegrationPhase58Band = new DocumentIntelIntegrationPhase58Band();

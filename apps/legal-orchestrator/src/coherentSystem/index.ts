export * from "./lawEngineBand.js";
export * from "./rerankerV2.js";
export * from "./retrievalBand.js";
export * from "./zone2RetrievalTypes.js";
export * from "./zone2RetrievalStub.js";
export * from "./retrievalHNSWPhase1.js";
export * from "./wasmBand.js";
export * from "./workspaceTemporalBand.js";
export * from "./documentIntelBand.js";
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

/** Default Phase 2 band wired to the Zone 2 stub (swap for real Zone2LawService later). */
export const lawEnginePhase2Band = new LawEnginePhase2Band(new Zone2LawServiceStub());

/** Default Phase 3 band (Phase 2 + refinement stub). */
export const lawEnginePhase3Band = new LawEnginePhase3Band(new Zone2LawServiceStub());

/** Default Phase 4 band (Phase 3 + compliance checklist stub). */
export const lawEnginePhase4Band = new LawEnginePhase4Band(new Zone2LawServiceStub());

/** Default Phase 5 band (Phase 4 + engagement pack finalization stub). */
export const lawEnginePhase5Band = new LawEnginePhase5Band(new Zone2LawServiceStub());

/** Sprint 26 — HNSW Phase 1 (Zone 2 retrieval stub for remote index hints). */
export const retrievalHnswPhase1Band = new RetrievalHNSWPhase1Band(new Zone2RetrievalServiceStub());

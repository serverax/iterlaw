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
import { RetrievalOllamaPhase2Band } from "./retrievalOllamaPhase2.js";
import { RetrievalStreamingPhase3Band } from "./retrievalStreamingPhase3.js";
import { RetrievalSpeculativePhase4Band } from "./retrievalSpeculativePhase4.js";
import { RetrievalLatencySLAPhase5Band } from "./retrievalLatencySLAPhase5.js";

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

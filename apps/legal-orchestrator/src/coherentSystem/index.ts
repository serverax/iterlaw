export * from "./lawEngineBand.js";
export * from "./rerankerV2.js";
export * from "./retrievalBand.js";
export * from "./wasmBand.js";
export * from "./workspaceTemporalBand.js";
export * from "./documentIntelBand.js";
export * from "./zone2LawTypes.js";
export * from "./zone2LawStub.js";
export * from "./lawEnginePhase2.js";

import { Zone2LawServiceStub } from "./zone2LawStub.js";
import { LawEnginePhase2Band } from "./lawEnginePhase2.js";

/** Default Phase 2 band wired to the Zone 2 stub (swap for real Zone2LawService later). */
export const lawEnginePhase2Band = new LawEnginePhase2Band(new Zone2LawServiceStub());

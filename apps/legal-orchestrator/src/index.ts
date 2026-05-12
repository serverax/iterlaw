// Public exports for re-use from other apps / tests.
export { createApp } from "./server.js";
export { handleLegalRequest } from "./pipeline/handleLegalRequest.js";
export { classifyRequest } from "./pipeline/classifyRequest.js";
export { immediateRiskCheck } from "./pipeline/immediateRiskCheck.js";
export { buildLegalPrompt } from "./pipeline/buildLegalPrompt.js";
export { StructuralCitationVerifier } from "./pipeline/verifyCitations.js";
export { policyGate } from "./pipeline/policyGate.js";
export { PgRagPort, mapRowToChunk } from "./ports/pgRagPort.js";
export * from "./types/legal.js";

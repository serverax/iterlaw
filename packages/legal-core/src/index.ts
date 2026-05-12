/** @iterlaw/legal-core — deterministic legal pipeline (AEE/ART/LVC/SEA) + UK constants */

export * from './legal/constants/ukEmploymentRates2026';
export * from './legal/rules/unfairDismissalTransition';
export * from './legal/rules/fireAndRehire';
export * from './legal/rules/zeroHoursReferencePeriod';
export * from './legal/rules/payAuditTriggers';

export {
  verifyLegalOutput,
  lvcConfidenceBand,
  type VerifyLegalInput,
  type VerifyLegalOutput,
} from './axiom/lvc/legalVerificationController';

export {
  runAxiomPipeline,
  buildEnqueuePayloadFromPipeline,
  type AeePhaseOutput,
  type ArtPhaseOutput,
  type AxiomPipelineInput,
  type AxiomPipelineResult,
  type EnqueuePayloadFromPipeline,
} from './axiom/orchestrator/runAxiomPipeline';

export {
  runSeaPhase,
  buildSeaInputFromLvc,
  CONFIDENT_THRESHOLD,
  type SeaPhaseInput,
  type SeaPhaseResult,
} from './axiom/sea/runSeaPhase';

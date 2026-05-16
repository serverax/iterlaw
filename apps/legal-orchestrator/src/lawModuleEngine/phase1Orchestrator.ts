import { findStatutoryCalculator, type StatutoryCalculatorStatus } from "../legalRules/statutoryCalculatorRegistry.js";
import { lawModuleInputFingerprint } from "./inputFingerprint.js";
import { blendRerankerWithCalculator } from "./rerankerBlend.js";
import { lawModuleEvidenceDensity, lawModuleEvidenceQualityScore } from "./evidencePackMetrics.js";

export interface LawModuleEnginePhase1Input {
  readonly moduleId: string;
  readonly calculatorId: string;
  readonly inputs: Record<string, unknown>;
  readonly evidenceEntryCount: number;
  /** Mean retrieval / reranker score in [0,1]. */
  readonly meanRerankerScore: number;
  /** Optional mean trust score across evidence entries [0,1]. */
  readonly meanEvidenceTrust?: number;
}

export interface LawModuleEnginePhase1Result {
  readonly moduleId: string;
  readonly calculatorFound: boolean;
  readonly calculatorStatus: StatutoryCalculatorStatus | null;
  readonly inputKeysSatisfied: boolean;
  readonly missingInputKeys: readonly string[];
  readonly inputFingerprint: string;
  readonly evidenceDensity: number;
  readonly evidenceQuality: number;
  readonly blendedEngineScore: number;
}

/**
 * Phase 1 orchestration: registry lookup, input coverage vs declared calculator inputs,
 * fingerprinting, evidence density, reranker blend. Pure — no DB writes here.
 */
export function runLawModuleEnginePhase1(input: LawModuleEnginePhase1Input): LawModuleEnginePhase1Result {
  const calc = findStatutoryCalculator(input.calculatorId);
  const missingInputKeys = calc ? calc.inputs.filter((k) => !(k in input.inputs)) : [];
  const inputKeysSatisfied = calc ? missingInputKeys.length === 0 : false;
  const fp = lawModuleInputFingerprint(input.inputs);
  const density = lawModuleEvidenceDensity(input.evidenceEntryCount);
  const trust = input.meanEvidenceTrust ?? input.meanRerankerScore;
  const evidenceQuality = lawModuleEvidenceQualityScore(density, trust);
  const blendedEngineScore = blendRerankerWithCalculator(calc?.status ?? null, input.meanRerankerScore);
  return {
    moduleId: input.moduleId,
    calculatorFound: !!calc,
    calculatorStatus: calc?.status ?? null,
    inputKeysSatisfied,
    missingInputKeys,
    inputFingerprint: fp,
    evidenceDensity: density,
    evidenceQuality,
    blendedEngineScore,
  };
}

/**
 * AEE → ART → LVC → SEA — legal pipeline owned by Azure Functions.
 */
import type { ArtRuntimeOptions } from '@rightsnow/shared';
import { runAxiomPipeline, type AxiomPipelineResult } from '@rightsnow/legal-core';
import { runAee, type AeeInput } from './aee';
import { runArt } from './art';

export type RunLegalPipelineInput = AeeInput & {
  artRuntime?: ArtRuntimeOptions;
};

export type RunLegalPipelineResult = AxiomPipelineResult & {
  aeeOut: ReturnType<typeof runAee>;
  artOut: ReturnType<typeof runArt>;
};

const defaultArtRuntime = (resolvedModel: string): ArtRuntimeOptions => ({
  resolvedModel,
  autoRunAi: false,
  logEstimatedAiCost: true,
});

export function runLegalPipeline(input: RunLegalPipelineInput): RunLegalPipelineResult {
  const aeeOut = runAee(input);
  const artOpts =
    input.artRuntime ??
    defaultArtRuntime(process.env.DEFAULT_AI_MODEL?.trim() || 'google/gemini-2.0-flash-001');
  const artOut = runArt(aeeOut, artOpts);
  const pipeline = runAxiomPipeline({
    extracted_facts: aeeOut.extracted_facts,
    reasoning_output: artOut.reasoning_output,
    legal_conclusions: artOut.legal_conclusions,
  });
  return {
    ...pipeline,
    aeeOut,
    artOut,
  };
}

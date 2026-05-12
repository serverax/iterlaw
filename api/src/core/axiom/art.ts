/**
 * ART — Axiom Reasoning Tracer (Functions host).
 * Cheap-first model routing (OpenRouter / Gemini) must be implemented here — never in web/mobile.
 * This scaffold emits source-backed shapes so LVC can run offline in CI.
 */
import type { ArtRuntimeOptions } from '@iterlaw/shared';
import type { AeeOutput } from './aee';

export type ArtOutput = {
  reasoning_output: {
    trace: string;
    topicsAddressed: string[];
  };
  legal_conclusions: Array<{
    text: string;
    source_type: string;
    reference: string;
  }>;
  /** Telemetry only; not consumed by LVC. */
  cost_control?: {
    resolved_model: string;
    auto_run_ai: boolean;
    estimated_cost_gbp: number | null;
  };
};

export function runArt(_input: AeeOutput, opts: ArtRuntimeOptions): ArtOutput {
  const trace =
    (opts.autoRunAi
      ? `AUTO_RUN_AI=true — would call LLM (${opts.resolvedModel}) here (not wired in scaffold). `
      : 'AUTO_RUN_AI=false — deterministic scaffold only; no external LLM call. ') +
    'Employment dismissal context: ordinary unfair dismissal qualifying service, automatic unfair dismissal heads, ' +
    'Equality Act discrimination, and ACAS disciplinary / grievance procedural fairness are noted for LVC coverage.';

  return {
    reasoning_output: {
      trace,
      topicsAddressed: ['unfair_dismissal', 'automatic_unfair', 'discrimination', 'acas_procedural'],
    },
    legal_conclusions: [
      {
        text: 'Informational routing summary (not legal advice).',
        source_type: 'GOV.UK',
        reference: 'https://www.gov.uk/dismissal',
      },
      {
        text: 'Statutory context — Employment Rights Act 1996 (illustrative anchor).',
        source_type: 'legislation',
        reference: 'https://www.legislation.gov.uk/ukpga/1996/18/contents',
      },
    ],
    cost_control: {
      resolved_model: opts.resolvedModel,
      auto_run_ai: opts.autoRunAi,
      estimated_cost_gbp: opts.logEstimatedAiCost ? 0 : null,
    },
  };
}

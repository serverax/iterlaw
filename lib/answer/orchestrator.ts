/* eslint-disable no-console -- answer pipeline diagnostics */
import { callAIFallback } from '@/lib/ai/orchestrate';
import { logAnswerCostEvent } from '@/lib/answer/cost-log';
import { EST_COST_GBP } from '@/lib/answer/costs';
import { queryAcasGuidance } from '@/lib/gov-apis/acas-guidance';
import { queryAllGovAPIs } from '@/lib/gov-apis/orchestrate';
import type { GovAPIResult, GovOrchestrationMetadata } from '@/lib/gov-apis/types';
import { computeContentHash } from '@/lib/qa-pool/content-hash';
import { findCachedUserAnswer, upsertCachedUserAnswer } from '@/lib/qa-pool/service';
import {
  toUserAnswer,
  validateAndFormatAnswer,
  validateAnswer,
  ValidationRules,
} from '@/lib/validation';
import type { FormattedAnswer, UserAnswer, UserContext } from '@/lib/validation/types';

export type AnswerPipelineSource = 'cache' | 'gov' | 'ai';

export interface AnswerOrchestratorResult {
  success: boolean;
  source?: AnswerPipelineSource;
  answer?: UserAnswer;
  escalate?: boolean;
  reason?: string;
  errors?: string[];
  metadata?: GovOrchestrationMetadata;
  layersTried: Array<'cache' | 'gov' | 'acas' | 'ai' | 'escalate'>;
  estimatedCostGbp: number;
}

function sortGovByRelevance(rows: GovAPIResult[]): GovAPIResult[] {
  return [...rows].sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
}

function buildUserContext(
  jurisdiction: string,
  situation_type?: string,
  employment_dates?: string
): UserContext {
  return { jurisdiction, situation_type, employment_dates };
}

function isShippable(confidence: number, passed: boolean, formatted?: FormattedAnswer, escalate?: boolean) {
  return (
    passed &&
    !!formatted &&
    !escalate &&
    confidence >= ValidationRules.CONFIDENCE_THRESHOLD_ESCALATE
  );
}

export async function orchestrateAnswer(input: {
  question: string;
  jurisdiction: 'england_wales' | 'scotland' | 'ni';
  companyName?: string;
  situation_type?: string;
  employment_dates?: string;
}): Promise<AnswerOrchestratorResult> {
  const { question, jurisdiction, companyName, situation_type, employment_dates } = input;
  const userContext = buildUserContext(jurisdiction, situation_type, employment_dates);
  const layersTried: AnswerOrchestratorResult['layersTried'] = [];
  let estimatedCostGbp = 0;
  const contentHash = computeContentHash(question, jurisdiction);

  const traceCost = async (
    layer: 'cache' | 'gov' | 'acas' | 'ai' | 'escalate',
    cost: number,
    meta?: Record<string, unknown>
  ) => {
    layersTried.push(layer);
    estimatedCostGbp += cost;
    await logAnswerCostEvent({ layer, estCostGbp: cost, contentHash, jurisdiction, meta });
  };

  const poolHit = await findCachedUserAnswer(question, jurisdiction);
  if (poolHit) {
    await traceCost('cache', EST_COST_GBP.cache, { hit: true });
    return {
      success: true,
      source: 'cache',
      answer: poolHit.answer,
      layersTried,
      estimatedCostGbp,
    };
  }
  await traceCost('cache', EST_COST_GBP.cache, { hit: false });

  const { results: govResults, metadata } = await queryAllGovAPIs(question, jurisdiction, companyName);
  let validation = await validateAndFormatAnswer(question, sortGovByRelevance(govResults), userContext);
  await traceCost('gov', EST_COST_GBP.gov, { results: govResults.length, passed: validation.passed });

  if (
    isShippable(validation.confidence, validation.passed, validation.formatted, validation.escalate) &&
    validation.formatted
  ) {
    const answer = toUserAnswer(validation.formatted, validation.confidence, validation.disclaimer, {
      cached: false,
    });
    await upsertCachedUserAnswer({ question, jurisdiction, answer, answerSource: 'gov' });
    return { success: true, source: 'gov', answer, metadata, layersTried, estimatedCostGbp };
  }

  const acasRows = await queryAcasGuidance(question);
  const merged = sortGovByRelevance([...govResults, ...acasRows]);
  validation = await validateAndFormatAnswer(question, merged, userContext);
  await traceCost('acas', EST_COST_GBP.acas, { results: acasRows.length, passed: validation.passed });

  if (
    isShippable(validation.confidence, validation.passed, validation.formatted, validation.escalate) &&
    validation.formatted
  ) {
    const answer = toUserAnswer(validation.formatted, validation.confidence, validation.disclaimer, {
      cached: false,
    });
    await upsertCachedUserAnswer({ question, jurisdiction, answer, answerSource: 'gov' });
    return { success: true, source: 'gov', answer, metadata, layersTried, estimatedCostGbp };
  }

  console.log('[answer-orchestrator] Gov + ACAS not shippable; attempting AI fallback...');
  const aiResponse = await callAIFallback(question, {
    jurisdiction,
    situation_type,
    employment_dates,
  });
  await traceCost('ai', EST_COST_GBP.ai_complex, { attempted: true, returned: Boolean(aiResponse) });

  if (!aiResponse) {
    await traceCost('escalate', 0, { reason: 'ai_unavailable_or_out_of_scope' });
    return {
      success: false,
      escalate: true,
      reason:
        'Question is outside employment law scope, requires a solicitor, or AI is unavailable.',
      metadata,
      layersTried,
      estimatedCostGbp,
    };
  }

  const aiFormatted: FormattedAnswer = {
    law_section: aiResponse.law_section,
    meaning: aiResponse.meaning,
    action: aiResponse.action,
    source_citation: aiResponse.source_citation,
    source_url: undefined,
    source_type: 'AI',
    confidence_score: aiResponse.confidence_score,
  };

  const aiValidation = validateAnswer(aiFormatted);
  if (
    !aiValidation.passed ||
    aiValidation.escalate ||
    aiValidation.confidence < ValidationRules.CONFIDENCE_THRESHOLD_ESCALATE ||
    !aiValidation.formatted
  ) {
    await traceCost('escalate', 0, { reason: 'ai_low_confidence', confidence: aiValidation.confidence });
    return {
      success: false,
      escalate: true,
      reason: `AI confidence too low (${aiValidation.confidence.toFixed(2)}) or validation failed.`,
      errors: aiValidation.errors,
      metadata,
      layersTried,
      estimatedCostGbp,
    };
  }

  const answer = toUserAnswer(aiValidation.formatted, aiValidation.confidence, aiValidation.disclaimer, {
    cached: false,
  });
  await upsertCachedUserAnswer({ question, jurisdiction, answer, answerSource: 'ai' });
  return { success: true, source: 'ai', answer, metadata, layersTried, estimatedCostGbp };
}

/* eslint-disable no-console -- AI fallback orchestration trace logs */
import { askClaudeSonnet } from './claude';
import { isWebAiFallbackEnabled } from './featureFlag';
import { classifyQuestion } from './gate';
import { askGeminiFlash } from './gemini';
import type { AIContext, AIResponse } from './types';

/**
 * AI fallback when Gov APIs / formatting / confidence are insufficient.
 * Routes SIMPLE → Gemini Flash, COMPLEX → Claude Sonnet.
 *
 * Sprint 12B gate: this fallback is disabled by default. When
 * ITERLAW_WEB_AI_FALLBACK_ENABLED is not set to "true"/"1", the function
 * returns null (treated upstream as "AI unavailable → escalate") and no
 * external provider call is made. This preserves the IterLaw invariant that
 * the legal answer path does not call external LLMs by default.
 */
export async function callAIFallback(
  question: string,
  context: AIContext
): Promise<AIResponse | null> {
  if (!isWebAiFallbackEnabled()) {
    console.log('[AI] Web AI fallback disabled by default (ITERLAW_WEB_AI_FALLBACK_ENABLED unset). Returning null.');
    return null;
  }

  console.log('[AI] Starting AI fallback...');

  const classification = await classifyQuestion(question, context.jurisdiction);

  if (classification.classification === 'OUT_OF_SCOPE') {
    console.log('[AI] Question out of scope');
    return null;
  }

  if (classification.classification === 'ESCALATE') {
    console.log('[AI] Question requires solicitor');
    return null;
  }

  let aiResponse: AIResponse;
  try {
    if (classification.classification === 'IN_SCOPE_SIMPLE') {
      console.log('[AI] Routing to Gemini Flash (simple)');
      aiResponse = await askGeminiFlash(question, context);
    } else {
      console.log('[AI] Routing to Claude Sonnet (complex)');
      aiResponse = await askClaudeSonnet(question, context);
    }
  } catch (error) {
    console.error('[AI] Model call failed:', error);
    return null;
  }

  return {
    ...aiResponse,
    source_citation: `${aiResponse.source_citation} (AI-assisted)`,
  };
}

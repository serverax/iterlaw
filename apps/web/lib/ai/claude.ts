/* eslint-disable no-console -- Claude client trace logs */
import axios from 'axios';
import { COST_PER_COMPLEX_CALL_GBP, logAiCall } from './costs';
import { isWebAiFallbackEnabled, WEB_AI_FALLBACK_DISABLED_MESSAGE } from './featureFlag';
import { normaliseAiResponse, parseJsonObject } from './json';
import { CLAUDE_SYSTEM_PROMPT } from './prompts';
import type { AIContext, AIResponse } from './types';

function getComplexTimeoutMs(): number {
  const raw = Number(process.env.AI_TIMEOUT_COMPLEX_MS ?? 10_000);
  return Number.isFinite(raw) ? Math.max(1000, raw) : 10_000;
}

function getClaudeModel(): string {
  return process.env.CLAUDE_MODEL?.trim() || 'claude-sonnet-4-20250514';
}

// IterLaw legal-answer path must not call external LLM providers by default.
// Sprint 12B gate: refuse before any network call unless
// ITERLAW_WEB_AI_FALLBACK_ENABLED is explicitly set.
export async function askClaudeSonnet(question: string, context: AIContext): Promise<AIResponse> {
  if (!isWebAiFallbackEnabled()) {
    throw new Error(WEB_AI_FALLBACK_DISABLED_MESSAGE);
  }

  console.log('[CLAUDE] Querying Claude Sonnet...');

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const userMessage = [
    `UK Employment Law Question (${context.jurisdiction})`,
    context.situation_type ? `Situation: ${context.situation_type}` : '',
    context.employment_dates ? `Employment: ${context.employment_dates}` : '',
    `Question: ${question}`,
    'Respond in JSON only with keys: law_section, meaning, action, source_citation, confidence_score.',
  ]
    .filter(Boolean)
    .join('\n');

  const timeoutMs = getComplexTimeoutMs();
  const { data } = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: getClaudeModel(),
      max_tokens: 900,
      temperature: 0.2,
      system: CLAUDE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    },
    {
      timeout: timeoutMs,
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    }
  );

  const textBlock = Array.isArray(data?.content)
    ? data.content.find((c: { type?: string }) => c?.type === 'text')
    : undefined;
  const text = typeof textBlock?.text === 'string' ? textBlock.text : '';
  if (!text.trim()) {
    throw new Error('No text content in Claude response');
  }

  const parsed = parseJsonObject(text);
  const response = normaliseAiResponse(parsed);

  const usage = data?.usage;
  const promptTokens = typeof usage?.input_tokens === 'number' ? usage.input_tokens : undefined;
  const completionTokens = typeof usage?.output_tokens === 'number' ? usage.output_tokens : undefined;

  logAiCall({
    model: 'claude-sonnet',
    questionType: 'answer_complex',
    promptTokens,
    completionTokens,
    estCostGbp: COST_PER_COMPLEX_CALL_GBP,
  });

  console.log(`[CLAUDE] Response received (confidence: ${response.confidence_score})`);
  return response;
}

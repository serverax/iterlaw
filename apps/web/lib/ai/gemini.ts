/* eslint-disable no-console -- Gemini client trace logs */
import axios from 'axios';
import { COST_PER_SIMPLE_CALL_GBP, logAiCall } from './costs';
import { isWebAiFallbackEnabled, WEB_AI_FALLBACK_DISABLED_MESSAGE } from './featureFlag';
import { normaliseAiResponse, parseJsonObject } from './json';
import { GEMINI_SYSTEM_PROMPT } from './prompts';
import type { AIContext, AIResponse } from './types';

function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
}

function getSimpleTimeoutMs(): number {
  const raw = Number(process.env.AI_TIMEOUT_SIMPLE_MS ?? 6000);
  return Number.isFinite(raw) ? Math.max(1000, raw) : 6000;
}

// IterLaw legal-answer path must not call external LLM providers by default.
// Sprint 12B gate: refuse before any network call unless
// ITERLAW_WEB_AI_FALLBACK_ENABLED is explicitly set.
export async function geminiGenerateText(options: {
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
  timeoutMs: number;
  responseMimeType?: 'application/json' | 'text/plain';
}): Promise<{ text: string; promptTokens?: number; completionTokens?: number }> {
  if (!isWebAiFallbackEnabled()) {
    throw new Error(WEB_AI_FALLBACK_DISABLED_MESSAGE);
  }

  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) {
    throw new Error('GOOGLE_AI_API_KEY is not set');
  }

  const model = getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const { data } = await axios.post(
    url,
    {
      systemInstruction: { parts: [{ text: options.systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: options.userPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: options.maxOutputTokens,
        responseMimeType: options.responseMimeType ?? 'text/plain',
      },
    },
    {
      params: { key },
      timeout: options.timeoutMs,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const text =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join('') ?? '';

  const usage = data?.usageMetadata;
  const promptTokens = typeof usage?.promptTokenCount === 'number' ? usage.promptTokenCount : undefined;
  const completionTokens =
    typeof usage?.candidatesTokenCount === 'number' ? usage.candidatesTokenCount : undefined;

  if (!text.trim()) {
    throw new Error('Empty Gemini response');
  }

  return { text, promptTokens, completionTokens };
}

export async function askGeminiFlash(question: string, context: AIContext): Promise<AIResponse> {
  console.log('[GEMINI] Querying Gemini Flash...');

  const userMessage = [
    `Jurisdiction: ${context.jurisdiction}`,
    context.situation_type ? `Situation type: ${context.situation_type}` : '',
    `Question: ${question}`,
    'Return JSON only with keys: law_section, meaning, action, source_citation, confidence_score.',
  ]
    .filter(Boolean)
    .join('\n');

  const timeoutMs = getSimpleTimeoutMs();
  const { text, promptTokens, completionTokens } = await geminiGenerateText({
    systemPrompt: GEMINI_SYSTEM_PROMPT,
    userPrompt: userMessage,
    maxOutputTokens: 700,
    timeoutMs,
    responseMimeType: 'application/json',
  });

  const parsed = parseJsonObject(text);
  const response = normaliseAiResponse(parsed);

  logAiCall({
    model: 'gemini-flash',
    questionType: 'answer_simple',
    promptTokens,
    completionTokens,
    estCostGbp: COST_PER_SIMPLE_CALL_GBP,
  });

  console.log(`[GEMINI] Response received (confidence: ${response.confidence_score})`);
  return response;
}

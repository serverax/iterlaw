/* eslint-disable no-console -- gate classifier trace logs */
import { COST_PER_SIMPLE_CALL_GBP, logAiCall } from './costs';
import { geminiGenerateText } from './gemini';
import { parseJsonObject } from './json';
import { GATE_SYSTEM_PROMPT } from './prompts';
import type { ClassificationResult, QuestionClass } from './types';

const VALID_CLASSES: QuestionClass[] = [
  'IN_SCOPE_SIMPLE',
  'IN_SCOPE_COMPLEX',
  'OUT_OF_SCOPE',
  'ESCALATE',
];

function isQuestionClass(value: unknown): value is QuestionClass {
  return typeof value === 'string' && (VALID_CLASSES as string[]).includes(value);
}

export async function classifyQuestion(
  question: string,
  jurisdiction: string
): Promise<ClassificationResult> {
  console.log(`[GATE] Classifying: "${question}"`);

  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) {
    console.warn('[GATE] GOOGLE_AI_API_KEY missing; defaulting to IN_SCOPE_COMPLEX');
    return {
      classification: 'IN_SCOPE_COMPLEX',
      reasoning: 'Classification unavailable (missing GOOGLE_AI_API_KEY)',
      confidence: 0.5,
    };
  }

  const userMessage = [
    `Jurisdiction: ${jurisdiction}`,
    `Classify this UK employment law question:\n\n"${question}"`,
    'Return JSON only: {"class":"IN_SCOPE_SIMPLE|IN_SCOPE_COMPLEX|OUT_OF_SCOPE|ESCALATE","reasoning":"short string"}',
  ].join('\n');

  try {
    const simpleTimeout = Number(process.env.AI_TIMEOUT_SIMPLE_MS ?? 6000);
    const timeoutMs = Number.isFinite(simpleTimeout) ? Math.max(1000, simpleTimeout) : 6000;

    const { text, promptTokens, completionTokens } = await geminiGenerateText({
      systemPrompt: GATE_SYSTEM_PROMPT,
      userPrompt: userMessage,
      maxOutputTokens: 150,
      timeoutMs,
      responseMimeType: 'application/json',
    });

    const parsed = parseJsonObject(text) as Record<string, unknown>;
    const cls = parsed.class ?? parsed.classification ?? parsed.Classification ?? parsed['class'];
    const reasoning = String(parsed.reasoning ?? '');

    if (!isQuestionClass(cls)) {
      console.warn(`[GATE] Invalid classification: ${String(cls)}, defaulting to IN_SCOPE_COMPLEX`);
      return {
        classification: 'IN_SCOPE_COMPLEX',
        reasoning: 'Classification error, treating as complex',
        confidence: 0.5,
      };
    }

    logAiCall({
      model: 'gate-gemini',
      questionType: 'classification',
      promptTokens,
      completionTokens,
      estCostGbp: COST_PER_SIMPLE_CALL_GBP,
    });

    console.log(`[GATE] Classification: ${cls}`);
    return { classification: cls, reasoning, confidence: 0.9 };
  } catch (error) {
    console.error('[GATE] Parse/classification error:', error);
    return {
      classification: 'IN_SCOPE_COMPLEX',
      reasoning: 'Classification failed, treating as complex',
      confidence: 0.5,
    };
  }
}

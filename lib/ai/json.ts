import type { AIResponse } from './types';

export function normaliseAiResponse(parsed: unknown): AIResponse {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid AI JSON payload');
  }
  const obj = parsed as Record<string, unknown>;
  const law_section = String(obj.law_section ?? '').trim();
  const meaning = String(obj.meaning ?? '').trim();
  const action = String(obj.action ?? '').trim();
  const source_citation = String(obj.source_citation ?? '').trim();
  const confidenceRaw = Number(obj.confidence_score ?? obj.confidence ?? 0.65);
  const confidence_score = Math.min(1, Math.max(0, Number.isFinite(confidenceRaw) ? confidenceRaw : 0.65));

  return { law_section, meaning, action, source_citation, confidence_score };
}

export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // ignore
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // ignore
    }
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      // ignore
    }
  }

  throw new Error('Unable to parse JSON from model output');
}

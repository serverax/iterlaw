/**
 * AEE — Axiom Extraction Engine (Functions host).
 * Deterministic baseline extraction; LLM-backed extraction would call OpenRouter/Gemini here only.
 */
export type AeeInput = {
  question_text: string;
  document_text?: string;
  hints?: Record<string, unknown>;
};

export type AeeOutput = {
  extracted_facts: Record<string, unknown>;
};

export function runAee(input: AeeInput): AeeOutput {
  const facts: Record<string, unknown> = {
    question_text: input.question_text,
    ...(input.document_text ? { document_text: input.document_text } : {}),
    ...(input.hints ?? {}),
  };
  return { extracted_facts: facts };
}

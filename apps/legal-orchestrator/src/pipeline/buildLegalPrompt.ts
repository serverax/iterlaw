// Prompt builder (Phase 12). The LLM receives only what's in the structure
// below. No DB credentials, no unrelated chunks, no PII beyond what's been
// explicitly redacted upstream.

import type { Classification, ExtractedFacts, RagChunk, RiskCheck } from "../types/legal.js";

export interface LegalModelPrompt {
  system: string;
  user: string;
  chunk_ids: string[];   // Echoed back so the citation verifier can audit usage.
}

const SYSTEM_PROMPT = `You are a UK employment-law assistant. You may only answer using the supplied legal sources.
If the supplied sources do not support the answer, say the evidence is insufficient. Every legal proposition must cite at least one source by its chunk_id. Do not invent cases, statutory sections, deadlines, or remedies. Do not use casual language. Do not use emojis. Do not promise outcomes.`;

const ANSWER_FORMAT = `Use this exact structure:

Legal position:
Risk level:
Evidence relied on:
Relevant law:
Application to the facts:
Recommended next step:
Citations: (list of chunk_id values; one per line)
Confidence level:`;

function renderChunk(c: RagChunk): string {
  const sec = c.section_reference ? ` (section ${c.section_reference})` : "";
  return `--- chunk_id=${c.chunk_id} authority=${c.authority_level} source=${c.source_type} title="${c.title}"${sec} url=${c.url}
${c.chunk_text}`;
}

export function buildLegalPrompt(input: {
  question: string;
  classification: Classification;
  facts: ExtractedFacts;
  risk: RiskCheck;
  chunks: RagChunk[];
}): LegalModelPrompt {
  const { question, classification, facts, risk, chunks } = input;

  const factsRendered = Object.entries(facts)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("\n");

  const ruleHits = risk.rule_hits.length > 0 ? risk.rule_hits.join(", ") : "(none)";

  const user = [
    `Question: ${question}`,
    "",
    `Classification: ${classification.question_type} / ${classification.area_of_law} / jurisdiction=${classification.jurisdiction}`,
    "",
    "Known facts (no invented data permitted):",
    factsRendered.length > 0 ? factsRendered : "(none provided)",
    "",
    `Rule-engine hits: ${ruleHits}`,
    "",
    "Available legal sources:",
    chunks.map(renderChunk).join("\n\n"),
    "",
    ANSWER_FORMAT,
  ].join("\n");

  return {
    system: SYSTEM_PROMPT,
    user,
    chunk_ids: chunks.map((c) => c.chunk_id),
  };
}

// Pure prompt builder. Composes a system + user prompt that contains
// ONLY the supplied retrieved chunks plus a strict "cite by chunkId"
// rule. The output's `allowedCitationIds` is the whitelist enforced
// later by the LLM output guard.
//
// Rules baked into the prompt:
//   - Use only the supplied sources.
//   - Cite by chunkId in square brackets.
//   - Refuse with `insufficient_sources` if the sources do not support
//     a complete answer.
//   - Do not include secrets, DSNs, API keys, or unrelated PII.
//
// The builder NEVER touches process.env or any DSN. The system prompt
// is a fixed string; the user prompt only contains the values
// explicitly passed in.

import type {
  CitationBoundPromptInput,
  CitationBoundPromptOutput,
} from "./llm.types";

const SYSTEM_PROMPT = [
  "You are IterLaw, a UK employment law information assistant.",
  "Rules:",
  "1. Use ONLY the legal sources I supply below. Do not invent statutes, regulations, cases, or guidance pages.",
  "2. Cite by chunkId in square brackets, e.g. [chunk_abc].",
  "3. If the supplied sources do not support a complete answer, respond exactly with: insufficient_sources",
  "4. Do not include secrets, database connection strings, API keys, or any unrelated personal data.",
  "5. Do not present yourself as a qualified solicitor. Use phrasing like 'AI legal assistant' or 'source-grounded legal information'.",
].join("\n");

const MAX_CHUNK_SNIPPET = 1200;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

export function buildCitationBoundPrompt(
  input: CitationBoundPromptInput,
): CitationBoundPromptOutput {
  const allowedCitationIds = input.retrievedChunks.map((c) => c.chunkId);

  const sourceList = input.retrievedChunks
    .map((c, idx) => {
      const head = `${idx + 1}. [${c.chunkId}] ${c.citationLabel}`;
      const url = c.url;
      const effective = c.effectiveDate ? ` (effective ${c.effectiveDate})` : "";
      const body = truncate(c.text, MAX_CHUNK_SNIPPET);
      return `${head}${effective}\n   URL: ${url}\n   Text: ${body}`;
    })
    .join("\n\n");

  const lines: string[] = [];
  lines.push(`Jurisdiction: ${input.jurisdiction ?? "UK"}`);
  lines.push(
    input.applicableOn
      ? `Law as at: ${input.applicableOn}`
      : "Law as at: current",
  );
  lines.push("");
  lines.push(`Question: ${input.question}`);
  lines.push("");
  lines.push("Sources (cite by [chunkId]):");
  if (sourceList.length === 0) {
    lines.push("(no sources supplied)");
  } else {
    lines.push(sourceList);
  }
  lines.push("");
  lines.push(
    "If the supplied sources cannot answer the question completely, respond: insufficient_sources",
  );

  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: lines.join("\n"),
    allowedCitationIds,
  };
}

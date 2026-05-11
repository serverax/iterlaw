// citationVerifier — refuses any answer whose citations don't trace to
// retrieved chunks. Pure function.
//
// Failure codes (strings; do not change without updating downstream
// consumers):
//   citation_missing            — zero citations declared
//   chunk_not_found:<id>        — declared citation references unknown chunk
//   quote_not_supported:<id>    — quote_text not present in chunk_text
//   answer_makes_claims_without_citations — answer looks like a legal
//                                  claim but no citations were declared

import type {
  CitationVerifierInput,
  CitationVerifierOutput,
} from "./contracts";

// Very rough heuristic: if the answer contains any of these phrases AND
// no citations were declared, treat it as an unsupported legal claim.
// Tightening this is a separate concern (Phase 14 of the bundle).
const CLAIM_HEURISTICS: RegExp[] = [
  /\bunder (the )?(Employment Rights Act|Equality Act|ERA 1996|EqA 2010)\b/i,
  /\bsection \d+/i,
  /\btribunal\b/i,
  /\bunfair(ly)? dismiss/i,
  /\bdiscriminat\w+\b/i,
  /\bACAS\b/i,
  /\bstatutory\b/i,
];

export function citationVerifier(
  input: CitationVerifierInput
): CitationVerifierOutput {
  const failures: string[] = [];
  const verified: string[] = [];

  if (input.citations.length === 0) {
    failures.push("citation_missing");
    if (CLAIM_HEURISTICS.some((re) => re.test(input.answer_text))) {
      failures.push("answer_makes_claims_without_citations");
    }
    return { pass: false, failures, verified_chunk_ids: [] };
  }

  const allowedChunkIds = new Set(input.retrieved_chunks.map((c) => c.chunk_id));
  const chunkById = new Map(input.retrieved_chunks.map((c) => [c.chunk_id, c]));

  for (const c of input.citations) {
    if (!allowedChunkIds.has(c.chunk_id)) {
      failures.push(`chunk_not_found:${c.chunk_id}`);
      continue;
    }
    if (c.quote_text) {
      const chunk = chunkById.get(c.chunk_id);
      if (chunk && !chunk.chunk_text.includes(c.quote_text)) {
        failures.push(`quote_not_supported:${c.chunk_id}`);
        continue;
      }
    }
    verified.push(c.chunk_id);
  }

  return {
    pass: failures.length === 0 && verified.length > 0,
    failures,
    verified_chunk_ids: verified,
  };
}

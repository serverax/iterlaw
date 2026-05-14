// Sprint 24 — Evidence pack builder.
//
// Composes the hardened citation verifier output with each citation's
// underlying RetrievalCandidate into a structured `EvidencePack`.
//
// Pure function. No DB. No network. No external LLM.

import type { RetrievalCandidate } from "../intelligence/intelligence.types";
import type { EvidencePack, EvidencePackEntry, CitationStatus } from "./evidencePack.types";
import { verifyCitationsHardened, type HardenedCitationVerifierInput } from "./citationVerifier";

export interface BuildEvidencePackInput extends HardenedCitationVerifierInput {
  /**
   * Optional override for which candidates back which claims. By default,
   * every cited chunk is treated as "claim_supported: true" unless the
   * verifier blocked it.
   */
  readonly claimSupportedByChunk?: ReadonlyMap<string, boolean>;
}

export function buildEvidencePack(input: BuildEvidencePackInput): EvidencePack {
  const verifier = verifyCitationsHardened(input);
  const candidates = new Map<string, RetrievalCandidate>();
  for (const c of input.retrievedCandidates) {
    candidates.set(c.candidate_id, c);
  }

  const entries: EvidencePackEntry[] = verifier.perCitation.map((p) => {
    const candidate = candidates.get(p.chunk_id);
    const claimSupported =
      input.claimSupportedByChunk?.get(p.chunk_id) ??
      (p.status === "fully_cited" || p.status === "needs_review");
    return {
      source_id: candidate?.source_id ?? "<unknown>",
      source_title: candidate?.source_title ?? null,
      source_url: candidate?.source_url ?? null,
      source_type: candidate?.source_type ?? "unknown",
      effective_from: candidate?.effective_from ?? null,
      effective_to: candidate?.effective_to ?? null,
      trust_score: p.trustScore,
      chunk_id: p.chunk_id,
      claim_supported: claimSupported,
      citation_status: p.status,
      warnings: p.warnings,
      reason_codes: p.reasonCodes,
    };
  });

  const reasonCodes: string[] = ["evidence_pack:built"];
  if (verifier.overallStatus.startsWith("blocked_")) {
    reasonCodes.push(`evidence_pack:${verifier.overallStatus}`);
  } else if (verifier.overallStatus === "needs_review") {
    reasonCodes.push("evidence_pack:needs_review");
  } else {
    reasonCodes.push("evidence_pack:fully_cited");
  }

  return {
    entries,
    overallStatus: verifier.overallStatus as CitationStatus,
    historicalMode: input.historicalMode === true,
    reasonCodes,
  };
}

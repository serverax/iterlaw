// Sprint 24 — Hardened citation verifier (wrapper).
//
// Builds on the existing `apps/legal-orchestrator/src/modules/citationVerifier.ts`
// (which already ensures every declared citation traces back to a retrieved
// chunk and that quoted text appears verbatim in the chunk). This wrapper adds:
//
//   - blocks a citation whose backing retrieval candidate has no source_url.
//   - blocks a citation whose candidate is superseded or whose
//     `effective_to` is in the past, unless `historicalMode` is true.
//   - flags a citation whose candidate trust score is below `minTrustScore`
//     as `needs_review`.
//   - blocks an answer that makes legal claims with zero declared citations.
//
// Pure function. No DB. No network. No external LLM.

import type { RetrievalCandidate } from "../intelligence/intelligence.types";
import { citationVerifier as baseCitationVerifier } from "../modules/citationVerifier";
import type { CitationStatus } from "./evidencePack.types";

export interface HardenedCitationVerifierInput {
  readonly answerText: string;
  readonly citations: ReadonlyArray<{
    readonly chunk_id: string;
    readonly quote_text?: string;
  }>;
  readonly retrievedCandidates: ReadonlyArray<RetrievalCandidate>;
  /** ISO date the verifier treats as "now". */
  readonly nowIsoDate: string;
  /** Trust score per candidate (0..1). Missing entries default to 0.7. */
  readonly trustScores?: ReadonlyMap<string, number>;
  /** When true, superseded / stale candidates are permitted with a warning. */
  readonly historicalMode?: boolean;
  /** Trust below this value is treated as weak (default 0.5). */
  readonly minTrustScore?: number;
}

export interface HardenedCitationVerifierResult {
  readonly pass: boolean;
  readonly perCitation: ReadonlyArray<{
    readonly chunk_id: string;
    readonly status: CitationStatus;
    readonly trustScore: number;
    readonly warnings: ReadonlyArray<string>;
    readonly reasonCodes: ReadonlyArray<string>;
  }>;
  readonly overallStatus: CitationStatus;
  readonly failures: ReadonlyArray<string>;
}

const DEFAULT_MIN_TRUST = 0.5;

export function verifyCitationsHardened(
  input: HardenedCitationVerifierInput,
): HardenedCitationVerifierResult {
  // 1) Run the base verifier first — preserves the existing failure shapes.
  const baseResult = baseCitationVerifier({
    answer_text: input.answerText,
    citations: input.citations.map((c) => ({
      chunk_id: c.chunk_id,
      quote_text: c.quote_text,
    })),
    retrieved_chunks: input.retrievedCandidates.map((c) => ({
      chunk_id: c.candidate_id,
      chunk_text: c.text,
      source_type: c.source_type,
      authority_level: c.authority_level ?? 0,
    })),
  });

  // Convert base failures into per-citation statuses where possible.
  const baseFailuresByChunk = new Map<string, CitationStatus>();
  for (const f of baseResult.failures) {
    if (f === "citation_missing" || f === "answer_makes_claims_without_citations") continue;
    const [kind, chunkId] = f.split(":") as [string, string | undefined];
    if (chunkId === undefined) continue;
    if (kind === "chunk_not_found") baseFailuresByChunk.set(chunkId, "blocked_chunk_not_found");
    else if (kind === "quote_not_supported") baseFailuresByChunk.set(chunkId, "blocked_quote_not_supported");
  }

  // Short-circuit when there are zero citations at all.
  if (input.citations.length === 0) {
    return {
      pass: false,
      perCitation: [],
      overallStatus: "blocked_no_citation",
      failures: baseResult.failures.length > 0 ? baseResult.failures : ["citation_missing"],
    };
  }

  // 2) Per-citation enrichment with source / trust / freshness gates.
  const candidatesById = new Map<string, RetrievalCandidate>();
  for (const c of input.retrievedCandidates) {
    candidatesById.set(c.candidate_id, c);
  }
  const today = input.nowIsoDate.slice(0, 10);
  const minTrust = input.minTrustScore ?? DEFAULT_MIN_TRUST;
  const trustScores = input.trustScores ?? new Map<string, number>();

  let anyBlocked = false;
  let anyNeedsReview = false;

  const perCitation = input.citations.map((cit) => {
    const warnings: string[] = [];
    const reasonCodes: string[] = [];
    let status: CitationStatus = "fully_cited";

    const baseStatus = baseFailuresByChunk.get(cit.chunk_id);
    if (baseStatus) {
      anyBlocked = true;
      reasonCodes.push(`citations:${baseStatus}`);
      return {
        chunk_id: cit.chunk_id,
        status: baseStatus,
        trustScore: 0,
        warnings,
        reasonCodes,
      };
    }

    const candidate = candidatesById.get(cit.chunk_id);
    if (!candidate) {
      anyBlocked = true;
      reasonCodes.push("citations:chunk_not_found");
      return {
        chunk_id: cit.chunk_id,
        status: "blocked_chunk_not_found" as CitationStatus,
        trustScore: 0,
        warnings,
        reasonCodes,
      };
    }

    const trust = trustScores.get(cit.chunk_id) ?? 0.7;

    if (!candidate.source_url || candidate.source_url.length === 0) {
      anyBlocked = true;
      reasonCodes.push("citations:no_source_url");
      return {
        chunk_id: cit.chunk_id,
        status: "blocked_no_source" as CitationStatus,
        trustScore: trust,
        warnings,
        reasonCodes,
      };
    }

    const isStale =
      (candidate.superseded_by !== undefined && candidate.superseded_by !== null) ||
      (candidate.effective_to !== undefined && candidate.effective_to !== null && candidate.effective_to < today);

    if (isStale) {
      if (input.historicalMode) {
        status = "needs_review";
        warnings.push("source is stale; serving in historical mode");
        reasonCodes.push("citations:stale_historical");
        anyNeedsReview = true;
      } else {
        status = "blocked_stale";
        reasonCodes.push("citations:stale");
        anyBlocked = true;
        return {
          chunk_id: cit.chunk_id,
          status,
          trustScore: trust,
          warnings,
          reasonCodes,
        };
      }
    }

    if (trust < minTrust) {
      if (trust === 0) {
        status = "blocked_low_trust";
        reasonCodes.push("citations:trust_zero");
        anyBlocked = true;
        return {
          chunk_id: cit.chunk_id,
          status,
          trustScore: trust,
          warnings,
          reasonCodes,
        };
      }
      status = "needs_review";
      warnings.push(`trust score ${trust.toFixed(2)} below min ${minTrust}`);
      reasonCodes.push("citations:weak_trust");
      anyNeedsReview = true;
    }

    if (status === "fully_cited") {
      reasonCodes.push("citations:ok");
    }

    return {
      chunk_id: cit.chunk_id,
      status,
      trustScore: trust,
      warnings,
      reasonCodes,
    };
  });

  let overallStatus: CitationStatus = "fully_cited";
  if (anyBlocked) {
    // Use the first blocked status we encounter for the overall.
    const firstBlocked = perCitation.find((p) =>
      p.status === "blocked_stale" ||
      p.status === "blocked_low_trust" ||
      p.status === "blocked_no_source" ||
      p.status === "blocked_quote_not_supported" ||
      p.status === "blocked_chunk_not_found",
    );
    overallStatus = firstBlocked?.status ?? "blocked_no_citation";
  } else if (anyNeedsReview) {
    overallStatus = "needs_review";
  }

  return {
    pass: !anyBlocked,
    perCitation,
    overallStatus,
    failures: baseResult.failures,
  };
}

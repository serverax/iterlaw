// Sprint 29 — Hardened citation gate adapter.
//
// Bridges the orchestrator's drafter output + retrieved chunks into the
// Sprint 24 hardened citation verifier and evidence-pack builder. The
// adapter is additive — it does NOT replace or weaken the legacy citation
// verifier (`apps/legal-orchestrator/src/modules/citationVerifier.ts`),
// which still runs in `runLegalModulePipeline`.
//
// Pure function. No DB. No network. No external LLM.

import type { RetrievalCandidate } from "../intelligence/intelligence.types";
import { buildEvidencePack } from "./evidencePackBuilder";
import type { EvidencePack, CitationStatus } from "./evidencePack.types";

/**
 * Lightweight citation shape that matches what the drafter / legacy
 * citation gate produces. Compatible with `BoundedSynthesisCitation` and
 * `modules/contracts.ts#CitationInput`.
 */
export interface OrchestratorCitationLike {
  readonly chunk_id?: string;
  readonly chunkId?: string;
  readonly quote_text?: string;
  readonly quoteText?: string;
}

/**
 * Minimum chunk-shape the adapter needs to construct a `RetrievalCandidate`.
 * Matches both `RetrievedChunk` (modules/contracts.ts) and
 * `RetrievedLegalChunk` (rag/retrieval.port.ts) — only the common subset is
 * read.
 */
export interface OrchestratorChunkLike {
  readonly chunk_id: string;
  readonly chunk_text: string;
  readonly source_type?: string;
  readonly source_id?: string;
  readonly title?: string | null;
  readonly url?: string | null;
  readonly effective_date?: string | null;
  readonly applicable_to?: string | null;
  readonly authority_level?: number | null;
}

export interface HardenedCitationGateInput {
  readonly answerText: string;
  readonly citations: ReadonlyArray<OrchestratorCitationLike>;
  readonly retrievedChunks: ReadonlyArray<OrchestratorChunkLike>;
  readonly nowIsoDate: string;
  readonly historicalMode?: boolean;
  readonly trustScores?: ReadonlyMap<string, number>;
}

export interface HardenedCitationGateResult {
  readonly pack: EvidencePack;
  readonly overallStatus: CitationStatus;
  readonly hardBlocked: boolean;
  readonly needsReview: boolean;
  readonly decisionTrace: ReadonlyArray<string>;
}

function toCandidate(c: OrchestratorChunkLike): RetrievalCandidate {
  return {
    candidate_id: c.chunk_id,
    source_type: ((c.source_type as RetrievalCandidate["source_type"]) ?? "approved_output"),
    source_id: c.source_id ?? c.chunk_id,
    source_title: c.title ?? null,
    source_url: c.url ?? null,
    text: c.chunk_text,
    effective_from: c.effective_date ?? null,
    effective_to: c.applicable_to ?? null,
    last_verified_at: null,
    superseded_by: null,
    qa_status: "approved",
    authority_level: c.authority_level ?? null,
    keyword_rank: null,
    vector_rank: null,
    reason_codes: [],
  };
}

function normaliseCitation(c: OrchestratorCitationLike): { chunk_id: string; quote_text?: string } {
  return {
    chunk_id: c.chunk_id ?? c.chunkId ?? "",
    quote_text: c.quote_text ?? c.quoteText,
  };
}

export function runHardenedCitationGate(input: HardenedCitationGateInput): HardenedCitationGateResult {
  const pack = buildEvidencePack({
    answerText: input.answerText,
    citations: input.citations.map(normaliseCitation),
    retrievedCandidates: input.retrievedChunks.map(toCandidate),
    nowIsoDate: input.nowIsoDate,
    historicalMode: input.historicalMode,
    trustScores: input.trustScores,
  });
  const hardBlocked = pack.overallStatus.startsWith("blocked_");
  const needsReview = pack.overallStatus === "needs_review";
  return {
    pack,
    overallStatus: pack.overallStatus,
    hardBlocked,
    needsReview,
    decisionTrace: [
      "citation_gate:entered",
      `citation_gate:status:${pack.overallStatus}`,
      ...pack.reasonCodes,
    ],
  };
}

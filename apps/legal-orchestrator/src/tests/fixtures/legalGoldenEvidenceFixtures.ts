// Sprint 34 — Evidence-attached golden fixtures.
//
// Each fixture pairs a golden scenario with a small set of `RetrievalCandidate`s
// playing the role of source material. The `evidence_status` field declares
// what shape the evidence is in (supported / missing / stale / weak), and
// `expected_outcome` declares what the orchestrator's hardened citation gate
// (Sprint 24) should produce: pass / block / needs_review.
//
// Synthetic. Deterministic. No external LLM. No DB. No network.

import type { RetrievalCandidate } from "../../intelligence/intelligence.types";

export type EvidenceStatus = "supported" | "missing" | "stale" | "weak";
export type GoldenExpectedOutcome = "pass" | "block" | "needs_review";

export interface LegalGoldenEvidenceFixture {
  readonly id: string;
  readonly label: string;
  readonly answerText: string;
  readonly citations: ReadonlyArray<{ chunk_id: string; quote_text?: string }>;
  readonly retrievedCandidates: ReadonlyArray<RetrievalCandidate>;
  readonly evidence_status: EvidenceStatus;
  readonly expected_outcome: GoldenExpectedOutcome;
  /** Optional trust scores keyed by candidate_id. */
  readonly trustScores?: Record<string, number>;
  readonly historicalMode?: boolean;
}

function fullSource(id: string, overrides: Partial<RetrievalCandidate> = {}): RetrievalCandidate {
  return {
    candidate_id: id,
    source_type: "statutory_source",
    source_id: `doc-${id}`,
    source_title: "Employment Rights Act 1996",
    source_url: `https://www.legislation.gov.uk/ukpga/1996/18/section/${id}`,
    text: "An employee has the right not to be unfairly dismissed by his employer.",
    effective_from: "1996-05-22",
    effective_to: null,
    last_verified_at: "2026-01-01",
    superseded_by: null,
    qa_status: "approved",
    authority_level: 90,
    keyword_rank: 1,
    vector_rank: null,
    reason_codes: [],
    ...overrides,
  };
}

export const GOLDEN_EVIDENCE_FIXTURES: ReadonlyArray<LegalGoldenEvidenceFixture> = [
  {
    id: "unfair_dismissal_supported",
    label: "Unfair dismissal — supported by ERA 1996 s94",
    answerText: "Section 94 ERA 1996 confers the right not to be unfairly dismissed.",
    citations: [{ chunk_id: "ud-1" }],
    retrievedCandidates: [fullSource("ud-1")],
    trustScores: { "ud-1": 0.9 },
    evidence_status: "supported",
    expected_outcome: "pass",
  },
  {
    id: "redundancy_supported",
    label: "Redundancy pay — supported by ERA 1996 s162",
    answerText: "Section 162 ERA 1996 calculates redundancy entitlement.",
    citations: [{ chunk_id: "red-1" }],
    retrievedCandidates: [fullSource("red-1")],
    trustScores: { "red-1": 0.9 },
    evidence_status: "supported",
    expected_outcome: "pass",
  },
  {
    id: "discrimination_missing_citation",
    label: "Discrimination — claim made with NO citations",
    answerText: "Under the Equality Act 2010 the worker has a prima facie claim under tribunal protection.",
    citations: [],
    retrievedCandidates: [],
    evidence_status: "missing",
    expected_outcome: "block",
  },
  {
    id: "holiday_pay_stale",
    label: "Holiday pay — stale source (effective_to in the past)",
    answerText: "Holiday pay is calculated under regulation 16.",
    citations: [{ chunk_id: "hol-stale" }],
    retrievedCandidates: [
      fullSource("hol-stale", { effective_to: "2010-01-01" }),
    ],
    trustScores: { "hol-stale": 0.9 },
    evidence_status: "stale",
    expected_outcome: "block",
  },
  {
    id: "holiday_pay_stale_historical_mode",
    label: "Holiday pay — stale source under historical mode (needs_review)",
    answerText: "Holiday pay was calculated under the prior 12-week window.",
    citations: [{ chunk_id: "hol-stale-h" }],
    retrievedCandidates: [
      fullSource("hol-stale-h", { effective_to: "2010-01-01" }),
    ],
    trustScores: { "hol-stale-h": 0.9 },
    evidence_status: "stale",
    expected_outcome: "needs_review",
    historicalMode: true,
  },
  {
    id: "notice_pay_supported",
    label: "Notice pay — supported by ERA 1996 s86",
    answerText: "Section 86 ERA 1996 sets the statutory minimum notice.",
    citations: [{ chunk_id: "np-1" }],
    retrievedCandidates: [fullSource("np-1")],
    trustScores: { "np-1": 0.9 },
    evidence_status: "supported",
    expected_outcome: "pass",
  },
  {
    id: "settlement_no_source_url",
    label: "Settlement agreement — citation backed by chunk with no source_url",
    answerText: "A settlement agreement requires independent legal advice under statute.",
    citations: [{ chunk_id: "sa-1" }],
    retrievedCandidates: [fullSource("sa-1", { source_url: null })],
    trustScores: { "sa-1": 0.9 },
    evidence_status: "missing",
    expected_outcome: "block",
  },
  {
    id: "whistleblowing_weak_trust",
    label: "Whistleblowing — weak-trust source (needs_review)",
    answerText: "Section 43 ERA 1996 defines protected disclosure.",
    citations: [{ chunk_id: "wb-1" }],
    retrievedCandidates: [fullSource("wb-1")],
    trustScores: { "wb-1": 0.3 },
    evidence_status: "weak",
    expected_outcome: "needs_review",
  },
  {
    id: "employment_status_supported",
    label: "Employment status — supported by judicial guidance",
    answerText: "Under the Autoclenz test the tribunal looks past the written agreement.",
    citations: [{ chunk_id: "es-1" }],
    retrievedCandidates: [fullSource("es-1")],
    trustScores: { "es-1": 0.9 },
    evidence_status: "supported",
    expected_outcome: "pass",
  },
  {
    id: "limitation_dates_supported",
    label: "Limitation dates — supported by ERA 1996 s111",
    answerText: "Section 111 ERA 1996 governs the limitation date.",
    citations: [{ chunk_id: "ld-1" }],
    retrievedCandidates: [fullSource("ld-1")],
    trustScores: { "ld-1": 0.9 },
    evidence_status: "supported",
    expected_outcome: "pass",
  },
];

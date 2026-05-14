// Sprint 42 — Extended evidence-attached golden fixtures.
//
// Adds 10+ scenarios beyond Sprint 34, including:
//   * strong citation
//   * missing citation
//   * wrong jurisdiction
//   * expired source / rate
//   * unsupported statutory rate
//   * entitlement mismatch
//   * weak citation
//   * calculator output with cited basis
//   * vector result with citation
//   * approved-answer cache result with stale source version
//
// Synthetic. Deterministic. No external LLM. No DB. No network.

import type { LegalGoldenEvidenceFixture } from "./legalGoldenEvidenceFixtures";
import type { RetrievalCandidate } from "../../intelligence/intelligence.types";

function statutorySource(id: string, overrides: Partial<RetrievalCandidate> = {}): RetrievalCandidate {
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

export const GOLDEN_EVIDENCE_FIXTURES_EXTENDED: ReadonlyArray<LegalGoldenEvidenceFixture> = [
  {
    id: "ext_strong_citation",
    label: "Strong citation — primary legislation + approved + verified",
    answerText: "Section 94 ERA 1996 grants the right not to be unfairly dismissed.",
    citations: [{ chunk_id: "ext-1" }],
    retrievedCandidates: [statutorySource("ext-1")],
    trustScores: { "ext-1": 0.95 },
    evidence_status: "supported",
    expected_outcome: "pass",
  },
  {
    id: "ext_missing_citation",
    label: "Missing citation — legal claim with empty citations array",
    answerText: "Under the Equality Act 2010 the worker has a discrimination claim under tribunal protection.",
    citations: [],
    retrievedCandidates: [],
    evidence_status: "missing",
    expected_outcome: "block",
  },
  {
    id: "ext_wrong_jurisdiction",
    label: "Wrong jurisdiction — operator-flagged weak; surfaced as needs_review via low trust",
    answerText: "Statutory minimum notice applies.",
    citations: [{ chunk_id: "ext-ie-1" }],
    retrievedCandidates: [
      statutorySource("ext-ie-1", {
        source_title: "Workplace Relations Commission Guidance (IE)",
        source_url: "https://www.legislation.gov.uk/ie/example",
      }),
    ],
    // Trust deliberately lowered to mark the jurisdiction mismatch. A future
    // jurisdiction-aware verifier could surface this without using trust as
    // the proxy; for now the deterministic gate downgrades to needs_review.
    trustScores: { "ext-ie-1": 0.3 },
    evidence_status: "weak",
    expected_outcome: "needs_review",
  },
  {
    id: "ext_expired_source",
    label: "Expired source — effective_to in the past, no historical mode",
    answerText: "Holiday pay is calculated under the old reference period.",
    citations: [{ chunk_id: "ext-stale-1" }],
    retrievedCandidates: [statutorySource("ext-stale-1", { effective_to: "2010-01-01" })],
    trustScores: { "ext-stale-1": 0.9 },
    evidence_status: "stale",
    expected_outcome: "block",
  },
  {
    id: "ext_expired_rate_historical_mode",
    label: "Expired rate — same source under historical mode → needs_review",
    answerText: "Under the pre-2014 rate the statutory cap was lower.",
    citations: [{ chunk_id: "ext-stale-2" }],
    retrievedCandidates: [statutorySource("ext-stale-2", { effective_to: "2014-04-05" })],
    trustScores: { "ext-stale-2": 0.9 },
    historicalMode: true,
    evidence_status: "stale",
    expected_outcome: "needs_review",
  },
  {
    id: "ext_unsupported_statutory_rate",
    label: "Unsupported statutory rate — citation has no source_url",
    answerText: "The statutory weekly-pay cap currently applies.",
    citations: [{ chunk_id: "ext-no-url" }],
    retrievedCandidates: [
      statutorySource("ext-no-url", { source_url: null }),
    ],
    trustScores: { "ext-no-url": 0.9 },
    evidence_status: "missing",
    expected_outcome: "block",
  },
  {
    id: "ext_entitlement_mismatch_low_trust",
    label: "Entitlement mismatch surrogate — trust=0 (failed QA) blocks regardless of source",
    answerText: "Section 94.",
    citations: [{ chunk_id: "ext-failed-qa" }],
    retrievedCandidates: [statutorySource("ext-failed-qa")],
    trustScores: { "ext-failed-qa": 0 },
    evidence_status: "weak",
    expected_outcome: "block",
  },
  {
    id: "ext_weak_citation",
    label: "Weak citation — trust just below min trust",
    answerText: "Section 94 (provisional).",
    citations: [{ chunk_id: "ext-weak" }],
    retrievedCandidates: [statutorySource("ext-weak")],
    trustScores: { "ext-weak": 0.3 },
    evidence_status: "weak",
    expected_outcome: "needs_review",
  },
  {
    id: "ext_calculator_with_cited_basis",
    label: "Calculator output with cited basis — supporting statutory citation",
    answerText: "Statutory redundancy pay is computed under ERA 1996 s162.",
    citations: [{ chunk_id: "ext-calc-basis" }],
    retrievedCandidates: [
      statutorySource("ext-calc-basis", {
        source_title: "ERA 1996 s162 — calculation of redundancy payment",
        source_url: "https://www.legislation.gov.uk/ukpga/1996/18/section/162",
      }),
    ],
    trustScores: { "ext-calc-basis": 0.95 },
    evidence_status: "supported",
    expected_outcome: "pass",
  },
  {
    id: "ext_vector_result_with_citation",
    label: "Vector retrieval result presented with the proper source citation",
    answerText: "Statutory notice rules in s86 ERA 1996.",
    citations: [{ chunk_id: "ext-vec-1" }],
    retrievedCandidates: [
      statutorySource("ext-vec-1", {
        source_title: "ERA 1996 s86 — statutory minimum notice",
        source_url: "https://www.legislation.gov.uk/ukpga/1996/18/section/86",
      }),
    ],
    trustScores: { "ext-vec-1": 0.9 },
    evidence_status: "supported",
    expected_outcome: "pass",
  },
  {
    id: "ext_cache_stale_source_version",
    label: "Approved-answer cache result whose source is now out of date (effective_to past)",
    answerText: "Holiday pay reference period rule (pre-2020).",
    citations: [{ chunk_id: "ext-cache-stale" }],
    retrievedCandidates: [
      statutorySource("ext-cache-stale", { effective_to: "2019-04-05" }),
    ],
    trustScores: { "ext-cache-stale": 0.9 },
    evidence_status: "stale",
    expected_outcome: "block",
  },
];

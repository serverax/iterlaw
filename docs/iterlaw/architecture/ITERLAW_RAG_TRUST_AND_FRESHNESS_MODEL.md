# IterLaw RAG Trust + Freshness Model

> Status: Active. Source of truth for `trustScorer.ts` and
> `freshnessFilter.ts`. Sprint 14 ships this model as a pure-function
> foundation; future sprints wire it into the answer path behind a
> feature flag.

## 1. Trust score (0..100)

| Score | Source class | Examples |
| --- | --- | --- |
| 100 | Primary legislation / statutory source | ERA 1996, Equality Act 2010 |
| 95  | Official ACAS guidance / GOV.UK guidance | ACAS Code of Practice on Disciplinary and Grievance Procedures, GOV.UK redundancy pay |
| 90  | Official tribunal / court source | EAT decisions, Supreme Court judgments |
| 85  | Approved internal architecture decision | Accepted ADR |
| 80  | Verified sprint report | A sprint report tagged QA: approved |
| 70  | Approved previous output | Approved-by-solicitor answer used previously |
| 50  | Draft AI output | Unapproved draft |
| 30  | Unreviewed content | Operator-uploaded but unvetted |
|  0  | Failed QA or blocked source | Any source where `qa_status = "failed"` |

### 1.1 Legal-mode demotions

For a legal question (`legal_mode = true`):

- `draft_ai_output` MUST NOT outrank statutory / acas / govuk / tribunal sources. The scorer caps it at the base `draft_ai_output` value (50).
- `architecture_decision` MUST NOT outrank tribunal_case. The scorer caps it at `BASE.tribunal_case - 1` (89).

### 1.2 QA-status overrides

- `qa_status = "failed"` → score 0, source_type marked `failed_qa_or_blocked`. Always.
- `qa_status = "unreviewed"` → score capped at 30, regardless of base.
- `qa_status = "draft"` on a non-`draft_ai_output` source → score capped at 50.

### 1.3 Reason codes

Every `TrustScore` carries a `reason_codes: string[]`. At minimum:

- `source_type:<value>`
- one of `qa_failed_or_blocked` / `qa_unreviewed_score_capped_at_30` / `qa_draft_score_capped_at_50` / `fresh_default`
- `legal_mode_*_capped` if applicable.

## 2. Freshness statuses

| Status | Trigger |
| --- | --- |
| `fresh` | Within `effective_from .. effective_to` window; no superseded_by; all required metadata present |
| `stale_effective_to_passed` | `effective_to < now` |
| `stale_superseded` | `superseded_by` is set |
| `needs_review_missing_dates` | Legal source has neither `effective_from` nor `effective_to` |
| `needs_review_no_last_verified` | Legal source lacks `last_verified_at` |
| `historical_only` | Otherwise stale, but `allow_historical = true` (historical-comparison use case) |

### 2.1 Hard filtering rules (legal mode)

`filterFreshForLegalAnswer` removes any candidate with status
`stale_effective_to_passed` or `stale_superseded`. It KEEPS:

- `fresh` (always),
- `needs_review_missing_dates` / `needs_review_no_last_verified` (the
  RAG evaluator escalates these to `needs_review`),
- `historical_only` (operator opted in).

### 2.2 Confidence factor

The context compressor multiplies trust by a freshness factor:

| Status | Factor |
| --- | --- |
| `fresh` | 1.0 |
| `historical_only` | 0.6 |
| `needs_review_*` | 0.5 |
| `stale_*` | 0.0 |

`confidence = (trust_score / 100) * factor`. Range 0..1. Stale legal
sources thus have confidence 0 even before the filter removes them —
defence in depth.

## 3. Source-class identification

The intelligence layer uses `RetrievalCandidate.source_type` as the
canonical class label. Mapping at ingest time is the ingestion
pipeline's responsibility. The trust scorer never re-classifies; it
only applies the table above.

## 4. Audit trail

A redacted audit envelope for any legal answer must include, per
candidate:

- `candidate_id`,
- `source_type`,
- `trust_score`,
- `freshness_status`,
- `reason_codes`.

It must NOT include the raw `evidence_text`, the DSN, the prompt, or
the full draft.

## 5. Future extensions

- Per-jurisdiction trust adjustments (devolved law in Scotland /
  Northern Ireland).
- Decay over time for stale-but-still-useful guidance.
- A separate `community_consensus` score for tribunal-decision
  weight clusters.

None of these are in Sprint 14 scope.

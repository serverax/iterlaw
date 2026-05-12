# Sprint 18 — Multimodal Evidence Grounding Beta

Status: **Planned / Future backlog.** Not started, not deployed, not
tested, not piloted.

> The system described here is referred to throughout as
> **multimodal evidence grounding**, not "video analysis". The
> distinction is legal: an evidence-grounding tool helps a user and
> reviewer surface and timestamp factual material from audio and
> video; it does not make findings of fact about tone, hostility,
> credibility, or discrimination. Any phrasing that suggests
> otherwise is forbidden in the active UX.

## Purpose

Add a future, privacy-controlled, **local-only** evidence-processing
capability for workplace audio/video evidence. The system should
support timestamped transcription, evidence indexing, contradiction
detection, and manual review. It **must not** make final findings
about tone, hostility, lying, credibility, or legal breach based
only on audio/video sentiment or body language.

## 1. Sprint scope

- Local audio transcription (no cloud transcription).
- Timestamped transcript generation.
- Evidence timeline extraction (link transcript segments to case
  timeline entries).
- Contradiction detection between transcript segments and other
  case facts.
- Manual "truth clip" review queue.
- Privacy sandbox (per-case namespace, encrypted-at-rest).
- DPIA requirement (see §3) **before** any pilot upload is enabled.
- Media retention / deletion rules (configurable per case; default
  short retention).
- No cloud transcription.
- No external media processing of any kind.
- Pilot limited to **5 advanced users**, all individually consented.

## 2. Legal and compliance guardrails

The implementation must respect:

- UK GDPR
- Data Protection Act 2018
- Data (Use and Access) Act 2025
- Article 22C safeguards for automated decision-making
- ICO workplace monitoring guidance
- Lawful basis
- Transparency
- Proportionality
- Data minimisation
- Retention limitation
- Right to erasure
- Human review

### Mandatory UX wording

The AI output is **an evidence-assistance tool, not a legal or
factual determination.**

Mandatory warning shown on every AI-flagged evidence finding in the
UI:

> "AI has flagged a possible evidence issue in this recording. This
> is not a legal finding or a factual finding. Please review the
> original recording and transcript before relying on it."

Mandatory wording on any UI element that mentions tone, sentiment,
facial expression, or body language:

> "Tone, emotion, facial expression, and body-language indicators
> are subjective. IterLaw must not treat them as proof of
> hostility, dishonesty, discrimination, or misconduct."

## 3. DPIA gate

Before **any** pilot upload feature is enabled, a Data Protection
Impact Assessment must be completed and signed off. The DPIA
checklist must cover, at minimum:

- Purpose of processing.
- Lawful basis.
- Special-category data risk (e.g. health, protected
  characteristics revealed in conversation).
- Biometric risk if face / voice recognition is attempted at any
  layer.
- Consent / legitimate-interest assessment.
- Third-party privacy risk (people other than the user appearing
  in recordings).
- Employer policy considerations (recording in the workplace).
- Tribunal evidence purpose.
- Retention period.
- Deletion process.
- Subject-access risk.
- Right to erasure path.
- Access controls.
- Encryption at rest.
- Audit logging.

The DPIA artefact is committed under `docs/iterlaw/dpia/`. The pilot
flag is gated on its presence and operator confirmation.

## 4. Technical architecture (target only)

Components (none implemented yet):

| Component | Role |
| --- | --- |
| Upload intake service | Receives encrypted upload; validates size / type. |
| Media quarantine store | Holds raw media pending malware scan. |
| Local transcription worker | Whisper-compatible local model; CPU-only on i7-8700. |
| Timestamped transcript store | Per-segment rows in `transcript_segments`. |
| Evidence timeline linker | Maps transcript segments → case-timeline events. |
| Contradiction detector | Flags inconsistent statements across transcript + other case facts. |
| Manual review queue | Operator / user-facing approval queue. |
| Redaction worker | Strips identifiable third-party voices on request. |
| Deletion worker | Honours retention + right-to-erasure. |
| Audit ledger | One row per access / processing event. |

Preferred local transcription:

- Whisper-compatible local model.
- WASM / AOT *only* if benchmarked and proven useful. Performance
  claims are forbidden until measured. **"Whisper-Turbo Wasm
  active" must not appear in any active doc unless a benchmark
  output exists.**
- Fallback to local CPU transcription worker if WASM is slower.
- **No cloud API at any stage.**

## 5. Hardware strategy for i7-8700

Constraints to design around:

- Video / audio processing is CPU-intensive.
- The master node must not be overloaded.
- Heavy media jobs run on a worker node where possible.
- Use queue-based processing — no synchronous transcription in the
  web request path.
- Limit concurrency.
- Enforce file size and duration limits.
- Lazy frame extraction: extract video frames only on demand for
  review preview; never always-on.

Suggested beta limits:

- Max file duration: 30 minutes.
- Max file size: configurable (default ~500 MB).
- Max concurrent media jobs: **1** on i7-8700.
- Default video frame extraction: every 5 seconds, only for review
  preview rendering.
- **No always-on facial / emotion detection.**

## 6. Timestamp citation model

Every claim derived from a recording must cite:

- `file_id`
- `transcript_segment_id`
- `start_timestamp`
- `end_timestamp`
- `confidence_score`
- `reviewer_status`

Example acceptable output:

> "Possible contradiction found between 04:12–04:30 and 18:05–18:19.
> Manual review required."

Forbidden outputs (under any circumstance):

- "Manager lied."
- "Manager was hostile."
- "This proves discrimination."

## 7. Database planning (proposed future tables)

All tables planned, none migrated. Each must carry `created_at`,
`updated_at`, `case_id`, an owner reference (user_id or
anonymised), `status`, audit fields, no raw secrets, and (where
relevant) a retention / deletion marker.

| Table | Purpose |
| --- | --- |
| `media_uploads` | One row per uploaded file; carries content hash. |
| `media_processing_jobs` | Async processing queue state. |
| `transcript_segments` | One row per segment with start/end ms. |
| `evidence_timeline_links` | Maps segments → case-timeline entries. |
| `contradiction_candidates` | Detected inconsistencies awaiting review. |
| `truth_clip_reviews` | Reviewer decisions on a clip. |
| `media_redaction_events` | Per-redaction audit. |
| `media_deletion_events` | Per-deletion audit (erasure / retention). |
| `multimodal_audit_events` | Catch-all audit of every access. |

## 8. Security model

Required:

- Encrypted storage at rest.
- Strict access control (case-scoped; one user one case).
- Private media URLs only.
- Signed short-lived access links.
- No public bucket access.
- Malware scanning before processing.
- File-type validation.
- Size limits.
- Deletion after configured retention period.
- Audit logs for every access.
- **No training on user recordings.**
- **No cross-case synthesis using raw media.**

## 9. UX rules

The UI must:

- Show transcript with timestamps.
- Show confidence levels per segment.
- Show manual review status (pending / approved / rejected).
- Show warning labels for subjective findings.
- Separate objective transcript evidence from subjective AI
  comments.
- Allow the user to delete media at any time.
- Allow the user to export transcript / evidence pack.
- Require explicit confirmation before any transcript is used in
  a generated legal document.

## 10. Pilot policy

Do **not** enable for full pilot.

- Limited beta only.
- **Maximum 5 advanced users**, individually consented.
- Manual review required.
- No automated legal conclusions.
- **No tribunal filing automation.**
- No employer-facing disclosure without user approval.

## 11. Acceptance criteria

Sprint 18 is PASS only if:

- Roadmap updated as future sprint.
- No claim of deployment.
- No media runtime added yet.
- DPIA gate documented.
- Article 22C / human-review guardrails documented.
- ICO / workplace-monitoring privacy risks documented.
- Timestamp-citation model documented.
- Subjective tone / body-language restrictions documented.
- Retention / deletion rules documented.
- Pilot limited to 5 advanced users.
- No external media processing path introduced.
- No forbidden project naming introduced.
- Repo verifiers still pass.

## 12. Out of scope for Sprint 18

- Production deployment of any media pipeline.
- Cloud transcription of any kind.
- Cross-case media synthesis.
- Tribunal filing automation.
- Always-on facial / emotion / body-language analytics.

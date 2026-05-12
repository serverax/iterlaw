# IterLaw — Fast Legal Answer Engine

## Why direct local-LLM calls are slow

The naive pattern is:

```
User → API → local LLM → answer
```

Every question waits on a 7B/12B parameter model running on a GPU shared
with the rest of the cluster. Per-token latency is roughly:

- First-token: ~1–3 s on `uk-employment-qwen:latest`
- Continuation: ~30–60 tokens/s
- A two-paragraph answer therefore takes 5–15 seconds

That budget is fine for novel legal analysis. It is **not** fine for:

- "What's the current NMW rate?" (statutory rate lookup — should be 50 ms)
- "Am I in time to bring an unfair-dismissal claim?" (date arithmetic —
  WASM rule module, ~10 ms)
- "Vento band for moderate injury to feelings, claim filed June 2026?"
  (table lookup + band selector — ~10 ms)
- Any question whose substantive answer was already produced for another
  user with the same facts and the same jurisdiction.

The Fast Legal Answer Engine routes around the local LLM whenever the
question can be answered deterministically or from cache.

## How Mother Brain controls answer planning

`apps/legal-orchestrator/src/intelligence/fastAnswerPlanner.ts` is a
pure, deterministic decision function. The orchestrator calls it after
classification + immediate-risk-check and before any retrieval or
synthesis work. It chooses exactly one of five modes:

| Mode               | When                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------- |
| `missing_facts`    | Required facts are missing (jurisdiction, dismissal_date for unfair dismissal, etc.).  |
| `instant_prepared` | Cache hit, prepared answer block, or deterministic deadline/calc/risk rule applies.    |
| `rag_grounded`     | No prepared answer; chunks are expected; a small/medium model can compose locally.     |
| `llm_composed`     | A bounded LLM job is needed but the question class is a standard one (drafting, etc.). |
| `deep_analysis`    | Document review or high-complexity question that needs the deep-reasoning model role.  |

The planner never opens the database, never calls a model, never hits
the network. It only consumes a structured input (already-classified
question + facts + hints from cache and prepared-answer lookups) and
returns a `FastAnswerResult` with a routing decision and an explainable
reason.

## How DB / cache / prepared answer blocks reduce latency

The Mother Brain consults three deterministic stores before reaching for
retrieval or synthesis:

1. **`legal_response_cache`** — full prior `(jurisdiction, question_fingerprint, facts_fingerprint, legal_pack)` answers.
   Hit → return the cached answer immediately. The cache stores the
   citations alongside the answer text so citation policy still
   applies.
2. **`legal_answer_blocks`** — operator-curated answer templates keyed
   by `(area_of_law, scenario_key, jurisdiction)`. Used for routine,
   high-traffic questions ("how do I bring an ET claim", "what is
   constructive dismissal") where a templated, citation-rich block is
   safer and faster than re-generating prose.
3. **Deterministic rule modules** (WASM rule runner; see
   `infra/iterlaw/wasm-contract.md`):
   - `deadline_calculator` — date arithmetic for limitation windows
   - `redundancy_calculator` — statutory pay
   - `nmw_rate_selector` — table lookup by date
   - `vento_band_selector` — band table by event date

If any of the three returns a high-confidence answer, the planner emits
`instant_prepared` and synthesis is skipped entirely.

## When to use prepared answer blocks

Use a prepared answer block when **all** of the following hold:

- The question class is enumerated (e.g. `unfair_dismissal_overview`,
  `acas_ec_process`, `nmw_rate_lookup`).
- A reviewed block exists for the matching `(area_of_law, jurisdiction)`.
- No fact in the request contradicts the block's preconditions.
- The block's `effective_from / effective_to` covers the applicable date.

The block is rendered with a small set of placeholders (current NMW
rates, statutory caps from `uk_emp_rag.statutory_rate`) before it is
returned. That placeholder render is deterministic — no LLM is used.

## When to use RAG

Use RAG (`rag_grounded`) when:

- No cache hit and no prepared answer block matches.
- Chunks are expected to exist for the area + jurisdiction.
- The question is a "factual + explanation" shape (not a drafting or
  document-review task).
- Authority-ranked retrieval can produce ≥ 2 chunks above the
  citation-quality threshold.

The orchestrator then enqueues a synthesis job on
`iterlaw:synthesis:requests` with the retrieved chunks. The
synthesis-worker composes the answer using `uk-employment-qwen:latest`
and returns it on the response stream.

## When to create an LLM router job

Use `llm_composed` or `deep_analysis` when:

- The question is a drafting task (response letter, grievance, ET1) →
  `uk-employment-drafting:latest`.
- The question is document review → `uk-employment-document:latest`.
- The question is multi-step legal reasoning that doesn't fit either of
  the simpler routes.

The planner does NOT call the model. It produces a structured
`LegalLlmJob` description (`{ task, role, priority, prompt_bundle_id,
expected_max_tokens }`) which the orchestrator enqueues on Redis
Streams. The synthesis-worker reads it, calls Ollama, and writes the
result back. The orchestrator then upserts the output into
`legal_llm_outputs` keyed by `(task_fingerprint, model_name)` so the
next equivalent question can be answered from cache.

## How cached LLM outputs are reused

Every LLM completion is persisted with three keys:

- `task_fingerprint` — sha256(prompt_bundle_id, model_name, redacted_inputs)
- `model_name` — `uk-employment-qwen:latest`, etc.
- `output_quality` — placeholder 0..1; raised by operator review

When a new request arrives:

1. The planner computes `task_fingerprint` from `(area_of_law,
   jurisdiction, facts_fingerprint, prompt_bundle_id)`.
2. The cache layer looks up `legal_llm_outputs` for that fingerprint.
3. If a row exists and is still inside its `expires_at` window AND its
   citations still verify, the cached output is returned and the LLM
   job is skipped.

This is the lever that gives ChatGPT-like UX without paying a model
round-trip on every request: the first user pays the LLM cost, and the
next users with structurally equivalent questions get the answer for
free (cache hit ≈ 10–30 ms).

## Future database tables

These are **proposed** for a later migration. Not added in this sprint.

| Table                          | Purpose                                                                                              | Key columns                                                                                                                       | Latency role                                                                       | Relationship to RAG / `legal_chunks`                                                | Expiry / versioning                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `legal_answer_blocks`          | Operator-curated answer templates keyed by scenario.                                                  | `id`, `scenario_key`, `area_of_law`, `jurisdiction`, `template_text`, `cited_chunk_ids[]`, `effective_from`, `effective_to`        | Skips RAG + synthesis when the scenario_key matches.                               | `cited_chunk_ids[]` references `legal_chunks.id` for citation re-verification.       | `effective_from` / `effective_to` per-row; revision is a new row, never an in-place update.          |
| `legal_scenario_playbooks`     | Multi-step playbooks (e.g. "constructive dismissal letter sequence").                                  | `id`, `scenario_key`, `steps[]`, `area_of_law`, `jurisdiction`                                                                    | Removes round-trips for predictable flows like grievance/appeal sequences.         | Each step may reference `legal_answer_blocks.id`.                                   | Manual versioning; bump `scenario_key` when changing semantics.                                       |
| `legal_issue_map`              | Maps natural-language phrasings to `(area_of_law, scenario_key)`.                                     | `id`, `phrase`, `phrase_normalised`, `area_of_law`, `scenario_key`, `confidence`                                                  | Lets the classifier hit an exact scenario faster than a generic LLM classify.       | Phrase rows fuel `classifyRequest`; no `legal_chunks` link.                          | `phrase_normalised` is regenerated when classifier rules change; rows do not expire on their own.    |
| `legal_question_flows`         | Decision-tree branches per area of law (e.g. unfair-dismissal triage tree).                            | `id`, `area_of_law`, `step_index`, `question_text`, `expected_facts[]`, `next_step_id`                                            | Replaces back-and-forth LLM clarifications with a deterministic flow.              | Independent.                                                                         | Versioned by `flow_version` column on each row.                                                       |
| `legal_deadline_rules`         | Limitation windows keyed by jurisdiction × area.                                                       | `id`, `jurisdiction`, `area_of_law`, `window_days`, `effective_from`, `effective_to`, `source_chunk_id`                            | Removes LLM from deadline calculations — the WASM rule consumes these rows.        | `source_chunk_id` ties each rule back to a citable `legal_chunks` row.              | Effective-dated; supersession is a new row with later `effective_from`.                                |
| `legal_calculation_rules`      | Statutory rate / cap tables (NMW, redundancy week cap, comp award cap).                                | `id`, `rule_key`, `jurisdiction`, `effective_from`, `effective_to`, `rate_pence` or `cap_pence`, `source_chunk_id`                 | Pure table lookup; no LLM.                                                          | `source_chunk_id` → `legal_chunks.id`.                                              | Effective-dated.                                                                                       |
| `legal_risk_rules`             | Risk triggers (e.g. limitation_imminent under 15 days, no_qualifying_service).                          | `id`, `jurisdiction`, `area_of_law`, `predicate_kind`, `predicate_args`, `risk_level`, `next_step_template_id`                    | Lets risk classification be a row lookup, not an LLM judgment.                     | May reference a `legal_chunks.id` for the citation backing the rule.                | Effective-dated; supersession by new row.                                                              |
| `legal_response_cache`         | Full prior answers keyed by question + facts fingerprint.                                              | `id`, `fingerprint`, `legal_pack`, `jurisdiction`, `answer_text`, `cited_chunk_ids[]`, `created_at`, `expires_at`, `model_name`     | Cache hit → 0 LLM round-trips. The hottest path of the engine.                     | `cited_chunk_ids[]` → `legal_chunks.id`; cache entry invalidates if any cited chunk is no longer `is_active`. | TTL via `expires_at`; cache invalidated if `version_date` on any cited chunk changes.                  |
| `legal_llm_jobs`               | Queued LLM tasks (drafting / deep analysis) with priority + cost cap.                                  | `id`, `task_fingerprint`, `role`, `model_name`, `prompt_bundle_id`, `priority`, `status`, `requested_by`, `created_at`              | Decouples user latency from model cold-start; user gets a job-id immediately.       | The prompt bundle includes the RAG chunk-id list; no in-row reference to chunks.    | Status enum (`queued`, `in_progress`, `complete`, `failed`); no row deletion — auditable.              |
| `legal_llm_outputs`            | Persisted LLM completions for reuse.                                                                   | `id`, `job_id`, `task_fingerprint`, `model_name`, `output_text`, `cited_chunk_ids[]`, `output_quality`, `created_at`, `expires_at`  | Future identical task → cache hit; no model call.                                  | `cited_chunk_ids[]` → `legal_chunks.id`; treated stale when any cited chunk supersedes.| TTL via `expires_at`; quality bump by operator review.                                                |
| `legal_audit_trace`            | Per-request audit trail of which path the engine took.                                                 | `id`, `request_id`, `decision_mode`, `routing_reason`, `inputs_redacted_hash`, `cache_hit`, `prepared_block_id`, `llm_job_id`, `created_at` | Observability so the team can see which questions still hit the LLM and why.        | Records the chunk-ids used, never the raw question or PII.                          | Append-only; retained for analytics; no PII so retention is governed by audit policy not GDPR window. |

All proposed tables follow the same pattern as the existing `public.legal_*` schema:
unique constraint up-front, soft supersession via `is_active=false` or
`effective_to` dating, **no destructive DELETE** anywhere.

## Dry-run mode (current sprint deliverable)

This sprint ships:

- The planner (`apps/legal-orchestrator/src/intelligence/fastAnswerPlanner.ts`) — pure function, deterministic, testable.
- The types (`apps/legal-orchestrator/src/intelligence/fastAnswer.types.ts`).
- This doc and tests.

The planner is not yet wired into `handleLegalRequest.ts`. Wiring is the
next sprint and depends on the new tables above being migrated. Until
then the planner runs in unit tests only.

## DB writes — disabled by default

No table in the proposed list exists yet. No migration is added in this
sprint. The planner consumes structured hints supplied by the caller
(`cache_hit?`, `prepared_block?`); when no caller provides those hints
the planner falls through to `rag_grounded` or `llm_composed` per its
deterministic rules.

## Later: Ollama / Bifrost gateway integration

When the synthesis-worker route is wired (it already exists in
`infra/iterlaw/synthesis-llm-contract.md`), `llm_composed` and
`deep_analysis` decisions become Redis Streams jobs of the shape:

```json
{
  "request_id": "req-...",
  "job_id": "job-...",
  "task_fingerprint": "sha256(...)",
  "role": "uk_employment_drafting",
  "model_name": "uk-employment-drafting:latest",
  "prompt_bundle_id": "draft_grievance_v1",
  "chunk_ids": ["chunk-...", "chunk-..."],
  "max_tokens": 1200,
  "priority": "normal"
}
```

`synthesis-worker` reads the job, calls
`http://ollama.ordinox-ai.svc.cluster.local:11434` (temporary; long-term
`iterlaw-llm` namespace behind a Bifrost-style gateway), and writes the
result back. The orchestrator persists it in `legal_llm_outputs`.

The orchestrator never calls a model directly. The fast-answer engine
is the bouncer at the door of the LLM queue — most requests never get
in the queue at all.

## Forbidden in the planner

- No `fetch`, `axios`, `pg`, or any other I/O client import.
- No `process.env` reads (the planner is configuration-free).
- No `Math.random` or `Date.now()` (deterministic given input).
- No throwing for control flow — return a `missing_facts` decision instead.

# IterLaw Semantic Cache — Design

> Status: Key-builder foundation only. Sprint 14 ships
> `semanticCache.ts` (key + hash + invalidator enum). No cache store
> is wired. Future sprint pairs this with a backing store (Redis,
> Postgres table, or in-memory LRU) behind an invalidation policy.

## 1. Goal

Reduce duplicate cost on identical legal questions in the same
workspace + project where nothing has changed since the previous
answer.

## 2. Cache key

A semantic cache key is a frozen object with these fields:

- `workspace_id` — tenant boundary;
- `project_id` — case/folder boundary inside a tenant;
- `normalized_question` — lower-cased, punctuation-stripped, whitespace-collapsed;
- `question_embedding_hash` — placeholder for an embedding model's
  output hash (the cache CAN function without it; supply `null` if
  unavailable);
- `retrieved_context_hash` — SHA-256 over the evidence pack's
  identifying fields (source_id, source_type, effective_from,
  effective_to, trust_score, first 64 chars of evidence_text).
  Order-independent;
- `latest_event_at` — most recent event timestamp visible to the
  workspace at the time of answer;
- `model_used` — model identifier (e.g. `uk-employment-qwen:latest`);
- `legal_mode` — boolean. Legal and non-legal answers cache
  separately.

Two cache keys are equal iff ALL of these fields match.

## 3. What MUST invalidate the cache

Even when the cache key matches, the caller must consider the cache
**invalid** if any of these has changed since the cached entry was
written:

- `law_source_changed` — an underlying legal source was updated;
- `user_uploaded_new_evidence` — workspace gained new user evidence;
- `sprint_status_changed` — project state changed (only relevant for
  project_status / technical_architecture intents);
- `case_facts_changed` — the case's facts dict changed;
- `previous_answer_high_risk` — never reuse high-risk legal answers
  without re-evaluation;
- `previous_answer_failed_citation_verification` — the cached answer
  later failed citation verification; do not reuse.

These map to the `INVALIDATORS` constant in `semanticCache.ts`.

## 4. Cache miss does NOT trigger external network calls

Cache miss simply means the gateway runs end-to-end. There is no
fall-back to an external LLM, no external retrieval, no third-party
API.

## 5. Storage choice (deferred)

For the first wiring sprint, a small in-memory LRU per orchestrator
pod is sufficient. Multi-pod cache requires a Redis sidecar that
already exists for the synthesis worker (`apps/synthesis-worker/`).
Either path remains operator-driven and outside Sprint 14 scope.

## 6. Security

- The cache key contains **no secrets**.
- The cache key contains a hash of evidence_text's first 64 chars,
  not the full text. A reader who sees the key cannot reconstruct
  the source.
- The cache key contains no DSN, no token, no password, no API key.

## 7. Observability

Each cache hit / miss event should emit:

- `cache_event_id`
- `cache_key.workspace_id`
- `cache_key.legal_mode`
- `outcome` (`hit` / `miss` / `invalidated` / `bypassed`)
- `invalidator` if applicable.

The redacted audit envelope can include `cache_event_id` and
`outcome`; it must NOT include the cache key fields beyond the
non-secret identifiers above.

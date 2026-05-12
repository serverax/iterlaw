# ADR 004 — Internal Synthesis Worker

- **Status:** Proposed
- **Date:** 2026-05-12
- **Supersedes:** none
- **Related:** Sprint 11 migrations 007/008/009 (`uk_emp_rag.q_a_cache`, supersession, rate history); existing `src/pipeline/handleLegalRequest.ts`; existing `src/rag/temporalFilter.ts` + `src/rag/postgresRetrieval.ts` retrieval surface.

## 1. Context

`legal-orchestrator` today is a deterministic request handler. Its pipeline is:

```
classifyRequest → immediateRiskCheck → deriveApplicableLegalDate
  → RetrievalPort.search (uk_emp_rag.legal_document_chunks, temporal-filtered)
  → runLegalModulePipeline
        ├─ piiRedactor
        ├─ deadlineChecker
        ├─ sourceRanker
        ├─ citationVerifier      (refuses uncited drafts)
        └─ policyGate
  → response: safe_answer | insufficient_sources | citation_failed | policy_failed
```

`citationVerifier` and `policyGate` are designed to gate a **draft answer**. There is currently no producer for that draft, so:

- When retrieval returns no chunks → `insufficient_sources`.
- When retrieval returns chunks → an empty draft is passed in deliberately, citation verification refuses it → `citation_failed`.

This is intentional: the standing operator rule is "no external LLM calls, no scraping, no outbound HTTP from `legal-orchestrator`". `external_llm_used: false` is part of the `/ready` contract.

The Sprint 11 schema reserved space for a real answer pipeline — `uk_emp_rag.q_a_cache` (migration 008) and `uk_emp_rag.q_a_cache_sources` (join table) — but the synthesizer that fills `answer_law_section / answer_meaning / answer_action` does not exist.

This ADR specifies how synthesis lands **without** breaking the standing rule.

## 2. Decision

Introduce a **separate Synthesis Worker workload**, deployed in the cluster alongside `legal-orchestrator` but in its own pod. The orchestrator addresses the worker over an internal queue. The orchestrator does not import a model client, does not hold model credentials, and does not call any external model endpoint.

```
                       ┌─────────────────────────────────────┐
  client HTTP   ─────▶ │  legal-orchestrator (existing)      │
                       │   retrieval + modules + gates       │
                       │   draftAnswer is NOT produced here  │
                       └────────────┬────────────────────────┘
                                    │ enqueue SynthesisRequest
                                    ▼
                       ┌─────────────────────────────────────┐
                       │  internal queue                     │
                       │   (Redis Streams; see §5)           │
                       └────────────┬────────────────────────┘
                                    │ XREADGROUP
                                    ▼
                       ┌─────────────────────────────────────┐
                       │  synthesis-worker (new workload)    │
                       │   loads model credentials from      │
                       │   its own SealedSecret              │
                       │   calls model, parses, returns      │
                       │   SynthesisResponse                 │
                       └────────────┬────────────────────────┘
                                    │ enqueue SynthesisResponse
                                    ▼
                       ┌─────────────────────────────────────┐
                       │  legal-orchestrator (resume)        │
                       │   feeds draftAnswer back through    │
                       │   citationVerifier + policyGate     │
                       │   stores in uk_emp_rag.q_a_cache    │
                       │   with status='draft'               │
                       └─────────────────────────────────────┘
```

The worker is a black box from the orchestrator's perspective. It can change models, providers, and prompts without touching `legal-orchestrator` code.

## 3. Addressing

- Worker exposes no HTTP. Communication is queue-only.
- Queue lives in-cluster (`redis.iterlaw-prod.svc.cluster.local`) — no public ingress.
- Orchestrator publishes to `synthesis-request` stream, reads from `synthesis-response-<orchestrator-instance>` stream. Per-instance response streams keep responses sticky to the originator and avoid head-of-line blocking under load.
- Request and response messages carry a `request_id` (UUID) so retries and timeouts are idempotent.
- Worker uses a Redis consumer group (`synthesis-workers`); multiple replicas share the work.

## 4. Contract

### 4.1 SynthesisRequest

```jsonc
{
  "request_id":     "uuid",
  "schema_version": "1",
  "submitted_at":   "RFC3339 timestamp",

  "legal_pack":     "uk_employment_england_wales",
  "jurisdiction":   "England and Wales",
  "area_of_law":    "unfair_dismissal",
  "applicable_on":  "YYYY-MM-DD",   // from deriveApplicableLegalDate; nullable

  "question":       "string (PII-redacted by piiRedactor)",

  "retrieved_chunks": [
    {
      "chunk_id":        "uuid",
      "document_id":     "uuid",
      "source_type":     "legislation | gov_guidance | acas_guidance | ...",
      "authority_level": 100,
      "citation_label":  "Employment Rights Act 1996 s.95",
      "url":             "https://www.legislation.gov.uk/...",
      "section_reference":   "95",
      "paragraph_reference": null,
      "effective_date":  "1996-08-22",   // nullable
      "applicable_to":   null,
      "chunk_text":      "string"
    }
  ],

  "ranked_source_ids":    ["uuid", ...],  // output of sourceRanker
  "declared_citations":   []              // empty on first attempt

  // No user_id, no IP, no session, no free-text history.
}
```

### 4.2 SynthesisResponse (success)

```jsonc
{
  "request_id":   "uuid",
  "status":       "ok",
  "draft":        {
    "answer_law_section": "string",
    "answer_meaning":     "string",
    "answer_action":      "string",
    "declared_citations": [
      { "chunk_id": "uuid", "section_reference": "95" }
    ]
  },
  "model": {
    "name":       "string",   // opaque identifier, not a brand promise
    "version":    "string"
  },
  "latency_ms":   1234
}
```

### 4.3 SynthesisResponse (failure)

```jsonc
{
  "request_id": "uuid",
  "status":     "timeout | model_error | refused | malformed",
  "error":      "short reason string, no stack trace",
  "latency_ms": 5000
}
```

### 4.4 Validation in the orchestrator

After dequeueing a `SynthesisResponse`, the orchestrator does **not** trust it. It:

1. Feeds `draft.answer_law_section / _meaning / _action` into the existing `runLegalModulePipeline` with `declaredCitations` set from `draft.declared_citations` and `retrievedChunks` set to the same chunks that were sent in the request.
2. `citationVerifier` runs unchanged — if a claim in the draft does not resolve to a retrieved chunk, the response is rejected with status `citation_failed` (existing behaviour).
3. `policyGate` runs unchanged.
4. Only an allowed draft is written to `uk_emp_rag.q_a_cache` with `status = 'draft'` (per migration 008). Sources are written to `uk_emp_rag.q_a_cache_sources`. A reviewer flips status to `'approved'` out of band.

The orchestrator's existing safety contract therefore continues to hold: a synthesis-worker that hallucinates a citation cannot escape — the existing gates reject it.

## 5. Queue Choice

Redis Streams.

- Already an acceptable in-cluster dependency for this stack; no new operational surface beyond a Redis StatefulSet + SealedSecret.
- Consumer groups give us at-least-once delivery + ack/retry semantics out of the box.
- Per-instance response streams (one per orchestrator pod, named with the pod's UID) avoid cross-pod fan-out.
- 24h `MAXLEN` cap on streams; nothing here is durable beyond what gets written to `uk_emp_rag.q_a_cache`.

NATS JetStream is an acceptable alternative if Redis is later removed from the stack; the contract above does not assume Redis.

## 6. Secrets and credentials

Model credentials live **only** on the synthesis-worker workload.

- `synthesis-worker-secrets` SealedSecret in the operator repo, namespace `iterlaw-prod`, mounted as env on the worker.
- The orchestrator's SealedSecret contains: `DATABASE_URL`, `REDIS_URL`. It does **not** contain any model API key.
- The cluster `NetworkPolicy` on the orchestrator pod denies egress to the public internet on `:443`. (This is the corrective for an earlier draft of `bifrost-gateway.yaml` that allowed `0.0.0.0/0:443`.)
- The worker's `NetworkPolicy` permits egress to the configured model endpoint and DNS only.

Effect: even if the orchestrator process is compromised, no model API key is in its memory or on its filesystem.

## 7. Failure modes

| Scenario | Orchestrator behaviour |
|---|---|
| Worker not running | `synthesis-response` does not arrive within `synthesis_timeout_ms` (default 8000). Orchestrator returns `status: insufficient_sources` with a `synthesis:unavailable` retrieval note. `/ready` reports the worker as unreachable. |
| Worker returns `status != 'ok'` | Orchestrator returns the corresponding pipeline status (`citation_failed`, `policy_failed`, or `synthesis_error`). No partial draft is written to cache. |
| Worker returns hallucinated citations | `citationVerifier` refuses. Response is `citation_failed`. Reviewer queue gets the failed draft + retrieved chunks for inspection. |
| Worker is slow under load | Orchestrator times out per-request, not globally; other requests continue. Consumer-group lag is a metric (see §8). |
| Worker is compromised | Cannot affect data integrity because all writes go through `citationVerifier` and `policyGate`. Worst case is denial-of-service via refused drafts. |
| Redis is down | Orchestrator's `/ready` reports `synthesis: unavailable`. Cluster CronJob alerts on consecutive failures. |

Fail-closed is the default in every row above: when in doubt, no user-facing answer ships.

## 8. Observability

The orchestrator emits structured log lines around the queue boundary only (no model output, no question, no PII):

- `synthesis.request.enqueued { request_id, area_of_law, jurisdiction, chunks }`
- `synthesis.response.received { request_id, status, latency_ms }`
- `synthesis.timeout { request_id, after_ms }`

The worker emits:

- `synthesis.invocation { request_id, model_name, latency_ms, status }`

Metrics: queue depth, p50/p95/p99 latency, refused-by-citation-gate rate, refused-by-policy-gate rate. No metric carries question or answer text.

## 9. What this ADR does *not* decide

- Which model the worker calls. The worker is a contract boundary; the inside is out of scope here.
- Pricing / cost model. The worker can be metered; that's a separate concern.
- Caching semantics inside the worker. The orchestrator's cache is `uk_emp_rag.q_a_cache`; the worker is stateless.
- Whether the orchestrator should support multiple worker pools (e.g. premium vs free). That's a future ADR; this one specifies one queue, one consumer group.

## 10. Acceptance criteria

This ADR is accepted when:

1. The contract in §4 is approved (request schema, response schema, validation flow).
2. The secrets boundary in §6 is approved (model credentials never on the orchestrator).
3. A separate ticket is opened for: (a) worker repo / image, (b) Redis StatefulSet manifest, (c) per-pod response stream wiring in the orchestrator, (d) `/ready` extension for `synthesis:` health.

Until those tickets land, the orchestrator continues to return `citation_failed` for any retrieval that succeeds — which is the current honest behaviour.

## 11. Open questions

- **Should `applicable_on` flow through to the worker prompt, or only through retrieval?** The request includes it for traceability, but the worker may not need it; retrieval has already filtered. Leaving it in for now so the worker can render dates in the meaning section if the model supports that.
- **Should the worker see `effective_date` / `applicable_to` per chunk?** Yes — included in §4.1. Lets the worker say "as in force at the relevant date" honestly.
- **Idempotency window.** A duplicate `request_id` arriving on the request stream should be deduplicated for at least 60 seconds; ties to worker restart behaviour.

---

End of ADR 004.

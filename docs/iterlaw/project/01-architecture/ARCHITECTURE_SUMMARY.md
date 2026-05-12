# IterLaw — Architecture Summary

One-page mental model of how IterLaw answers a legal question across multiple countries and law modules. Deep references in [`LEGAL_AI_CORE_PLATFORM_SCOPE.md`](LEGAL_AI_CORE_PLATFORM_SCOPE.md), [`MODULE_SUBSCRIPTION_ARCHITECTURE.md`](MODULE_SUBSCRIPTION_ARCHITECTURE.md), and the rest of this directory.

## 1. One App, Many Legal Modules

IterLaw is **one web application** that serves many country / law-domain modules. It is **not** a separate app per area of law.

- Users land in a single dashboard.
- Each subscribed (country × law-domain) pair appears as a workspace.
- First beta = UK Employment. Other modules are roadmap.
- Internal package surface stays modular so a future module ships without rewriting the app.

## 2. Country + Module Routing

Every legal question carries a `country_id` and a `module_id`. The orchestrator uses them to:

- Pick the **module-specific RAG corpus**, sources, and rules.
- Pick the **module-specific prompts, templates, and calculators**.
- Pick the **specialist AIA workflow** for that module.
- Pick the **language pack** for the user's locale.

Cross-country and cross-module retrieval is forbidden in the answer path unless an explicit federated-query flag is set (none today).

## 3. Subscription Entitlement Gate

Before any retrieval / drafting starts, the orchestrator must check that the user holds a valid subscription for the `(country_id, module_id)` pair on this request.

- Unpaid module → `module_not_subscribed` refusal status (target; not yet implemented).
- Locked modules show an upgrade message in the dashboard.
- The check runs **server-side**, not just in the UI. Backend rejects unpaid module access.
- Subscription state is read from `user_subscriptions` (planned table; see `WORKSPACE_AND_USER_DATA_ARCHITECTURE.md`).

## 4. Specialist Module Isolation

Each module owns, isolated from every other module:

- RAG corpus (sources, documents, chunks, embeddings).
- Legal sources allow-list and trust tiers.
- Rule pack (deterministic legal rules).
- System / user prompt templates.
- Document templates (grievance letter, ET1, etc.).
- Calculators (deadlines, statutory rates, awards).
- Citation policy (what authorities count, what citation format is required).
- Specialist AIA workflows (intake → classify → retrieve → draft → review).

A defect in one module must not change the behaviour of another module.

## 5. Shared Core Platform

The shared platform — same across modules — provides:

- Login, identity, session management.
- Billing, subscriptions, entitlement.
- Dashboard, chat UI, case management, notifications.
- RAG engine (multi-tier retrieval — see [`../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md`](../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md)).
- AI gateway / model routing (Sprint 11; disabled by default).
- Document engine (DOCX / PDF / XLSX; cited, jurisdiction-locked).
- Audit + monitoring + observability.
- PostgreSQL + pgvector + Redis cache.
- WASM deterministic modules.

## 6. Local-first Cost Model

Most repeated, deterministic, or already-answered legal questions must come from **DB / cache**, not real-time LLM:

- Exact-match hash cache (Redis).
- Semantic Q&A cache (`module_qa_cache`, HNSW target).
- Law-section module lookup (`law_section_modules`).
- Knowledge graph for deterministic legal facts (target).
- Background pre-builder fills the caches over time.

LLM synthesis is the **slow path**, not the default path.

## 7. LLM as Slow Path / Background Worker

The local LLM (Ollama / vLLM / llama.cpp worker) is used for:

- Novel questions not yet in cache.
- Bounded synthesis from retrieved chunks (under the citation gate).
- Pre-building Q&A cache entries (background worker).
- Difficult cases that need plain-English mapping.

External LLM (OpenAI / Anthropic / Gemini / Cohere / Mistral) is **not** the default path. The Sprint 11 transport policy denies their hostnames at runtime.

## 8. Offline-First Legal Database Model

IterLaw is **offline-first**. The offline / local legal database is the **first source of truth** for every legal answer; the LLM is a fallback / background builder, not the default answer engine.

- **Offline / local DB is first source of truth.** A live HTTP call to anything (LLM, external API) is not in the default answer path.
- **LLM is the slow path, not the default path.** A request only reaches the LLM after Redis cache, Q&A cache, section registry, deterministic rules / knowledge graph, and RAG have each had a chance to answer safely.
- **Answers must come from verified local data + citations.** Each tier emits a citation set that the citation gate then verifies against the local corpus.
- **Repeated questions are served from cache / DB.** The hot path for a frequent question is Tier 0 (Redis) or Tier 1 (semantic Q&A cache), with no LLM call.
- **LLM-generated answers must be validated and stored for future reuse.** When the LLM does run, its output is validated (citation + RAV) and written into `module_qa_cache` so the next user with the same question hits Tier 1.
- **Each country engine has its own offline DB and rules.** UK has one offline DB; Germany has another; they do not share answers unless an explicit, approved mapping exists. Country / module isolation is enforced before retrieval, not after.

Full contract: [`OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md`](OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md). Decision record: [`../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`](../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md).

## Request flow (intended target)

1. **User asks** a legal question inside a chosen module.
2. **Subscription gate** — confirm `(country_id, module_id)` is paid. Else `module_not_subscribed`.
3. **Classify** the request (topic, area, deadline check).
4. **Extract facts** (dismissal_date, employment_start_date, ACAS status, ...).
5. **Immediate risk check** — deadline imminent? → short-circuit warning.
6. **Multi-tier retrieval** (see Tier 0–5 in `MULTI_TIER_RETRIEVAL_ARCHITECTURE.md`):
   - Tier 0: Redis exact hash cache.
   - Tier 1: HNSW semantic Q&A cache.
   - Tier 2: `law_section_modules` tag / section lookup.
   - Tier 3: semantic law section / RAG search.
   - Tier 4: deterministic legal knowledge graph / formula lookup.
   - Tier 5: bounded local LLM fallback.
7. **Citation gate** — every retrieved chunk must carry `chunk_id`, `document_id`, `title`, `url`, `citation_label`. Drops on missing fields.
8. **Bounded local LLM synthesis** — only after retrieval succeeds. Local model only. Citations preserved.
9. **Safety gate** — policy + citation verifier. Block weak / uncited / out-of-jurisdiction.
10. **Solicitor-style response** with citations, effective dates, missing facts, next steps. **No low-confidence answer is shown as final** — escalate to the human approval queue (`SUPREME_CONTROLLER_ARCHITECTURE.md`).

## Refusal paths (safe by default)

The orchestrator returns one of these statuses instead of an answer when conditions are not safe:

| Status | When |
| --- | --- |
| `module_not_subscribed` | The user does not hold a valid subscription for the requested `(country, module)`. *Target — not yet wired.* |
| `insufficient_sources` | No RAG chunks were retrieved, or all chunks failed the citation gate. |
| `needs_more_facts` | Case facts are too thin to apply law safely. |
| `citation_failed` | A draft was produced but the citation verifier rejected it. |
| `policy_failed` | The policy gate (jurisdiction, PII, off-topic) rejected the draft. |
| `high_risk_deadline` | A statutory deadline is imminent / past — escalate. |
| `human_review_required` | Domain SME or legal reviewer must vet the result before display. |
| `llm_unavailable` | Local LLM gateway disabled / no transport / non-ok response. |
| `blocked_by_policy` | Router refused (e.g. legal drafting without retrieved chunks). |

## Hard rules

- **No hallucinated legal authority.** Every cited statute / case / guidance page maps to a real `legal_documents` / `legal_chunks` / `legal_cases` row.
- **No answer from model memory.** Bounded synthesis drafts only from retrieved chunks.
- **No external LLM call** in the orchestrator request path. Sprint 11 transport policy denies provider hosts.
- **No cross-country / cross-module retrieval** unless explicitly federated (no federated flag exists today).
- **No jurisdiction mixing.** Module + country lock the corpus.
- **Temporal correctness.** Answers reflect "law as at" a derived `applicable_on`. Retrieval SQL enforces it.

## Status in the repo today

- Request pipeline + classify + facts + risk check + retrieval port + temporal filter: wired in `apps/legal-orchestrator/src/`.
- Bounded synthesis guard: interface + refusal modes wired.
- Local LLM gateway: interface only, default `disabled` (Sprint 11). Audit + transport policy guardrails added (Sprint 11 Phase 2A).
- Module routing / subscription gate / multi-tier cache / specialist AIAs: **target architecture only** (Sprints 18–57; see `ROADMAP_REMAINING_SPRINTS.md`).
- Real corpus ingestion + first end-to-end cited answer: Sprint 10 operator close-out pending.

## Related summaries

- One-app scope — [`LEGAL_AI_CORE_PLATFORM_SCOPE.md`](LEGAL_AI_CORE_PLATFORM_SCOPE.md)
- Subscriptions — [`MODULE_SUBSCRIPTION_ARCHITECTURE.md`](MODULE_SUBSCRIPTION_ARCHITECTURE.md)
- Law module engine — [`LAW_MODULE_ENGINE_ARCHITECTURE.md`](LAW_MODULE_ENGINE_ARCHITECTURE.md)
- WASM intelligence — [`WASM_INTELLIGENCE_ARCHITECTURE.md`](WASM_INTELLIGENCE_ARCHITECTURE.md)
- Workspace / RLS / cases — [`WORKSPACE_AND_USER_DATA_ARCHITECTURE.md`](WORKSPACE_AND_USER_DATA_ARCHITECTURE.md)
- Supreme Controller — [`SUPREME_CONTROLLER_ARCHITECTURE.md`](SUPREME_CONTROLLER_ARCHITECTURE.md)
- Document intelligence — [`DOCUMENT_INTELLIGENCE_ARCHITECTURE.md`](DOCUMENT_INTELLIGENCE_ARCHITECTURE.md)
- DB shape — [`../02-database/DATABASE_SUMMARY.md`](../02-database/DATABASE_SUMMARY.md)
- RAG sources + citation contract — [`../03-rag/RAG_SUMMARY.md`](../03-rag/RAG_SUMMARY.md)
- Multi-tier retrieval — [`../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md`](../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md)
- Local LLM + WASM — [`../04-ai-llm/LOCAL_LLM_AND_WASM.md`](../04-ai-llm/LOCAL_LLM_AND_WASM.md)
- Speed + streaming — [`../04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md`](../04-ai-llm/SPEED_AND_STREAMING_ARCHITECTURE.md)
- RLS — [`../05-security/RLS_SECURITY_MODEL.md`](../05-security/RLS_SECURITY_MODEL.md)

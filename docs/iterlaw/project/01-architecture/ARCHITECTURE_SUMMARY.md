# IterLaw — Architecture Summary

One-page mental model of how a legal question becomes a safe, cited answer in IterLaw. For full plan see `docs/ITERLAW_PROJECT_PLAN.md`; for live RAG wiring see `docs/iterlaw/SPRINT_10_LIVE_RAG_PLAN.md`.

## Request flow (intended target)

1. **User asks** a UK employment-law question.
2. **Classify request** — topic, area of law, required deadline check.
3. **Extract facts** — dismissal_date, employment_start_date, ACAS status, etc.
4. **Immediate risk check** — limitation / deadline imminent? → short-circuit warning.
5. **Approved Q&A / trusted-DB search first.** Cached `verified_answers_cache` row matching the question fingerprint? → serve it.
6. **RAG retrieval** over verified UK employment law sources, applying temporal filters (`effective_date <= applicable_on`, `applicable_to >= applicable_on` or NULL).
7. **Citation gate** — every retrieved chunk must carry `chunk_id`, `document_id`, `title`, `url`, `citation_label`. Chunks without provenance are dropped.
8. **Bounded local LLM synthesis** — only after retrieval succeeds. Local model only. Citations preserved.
9. **Safety gate** — policy + citation verifier review the draft. Block weak / uncited / out-of-jurisdiction outputs.
10. **Solicitor-style response** with citations, effective dates, missing facts, next steps.

## Refusal paths (safe by default)

The orchestrator returns one of these statuses **instead of** an answer when conditions are not safe:

| Status | When |
| --- | --- |
| `insufficient_sources` | No RAG chunks were retrieved, or all chunks failed the citation gate. |
| `needs_more_facts` | The user's case facts are too thin to apply law safely (e.g. missing dismissal date). |
| `citation_failed` | A draft answer was produced but the citation verifier rejected it. |
| `policy_failed` | The policy gate (jurisdiction, PII, off-topic) rejected the draft. |
| `high_risk_deadline` | A statutory deadline is imminent / past — escalate to human advice. |
| `human_review_required` | Domain SME or legal reviewer must vet the result before display. |

These are not errors — they are the **expected safe-default outputs** when a cited answer cannot be produced.

## Hard rules

- **No hallucinated legal authority.** Every cited statute, regulation, guidance page, or case must come from a real `legal_documents` / `legal_chunks` / `legal_cases` row.
- **No answer from model memory.** The bounded synthesis layer drafts **only** from retrieved chunks; the model is forbidden from citing anything not in the retrieval set.
- **No external LLM call in the request path.** Sprint 11 added the local-LLM gateway interface (default `disabled`). No OpenAI / Anthropic / Gemini call from the orchestrator.
- **No fabricated citations.** Citation labels and URLs are passed through from the retrieved row, never invented.
- **No jurisdiction mixing.** UK-only by default; mismatch warning when the user asks about non-UK law.
- **Temporal correctness** — answers reflect "law as at" a derived `applicable_on` (dismissal_date first, incident_date fallback). The retrieval SQL enforces it.

## Status in the repo today

- Request pipeline + classify + facts + risk check + retrieval port + temporal filter: **wired** in `apps/legal-orchestrator/src/`.
- Bounded synthesis guard: interface + refusal modes wired (`apps/legal-orchestrator/src/legal/llm/boundedSynthesis.ts`).
- Local LLM gateway: **interface only**, default `disabled` (Sprint 11).
- Real corpus ingestion + first end-to-end cited answer: **Sprint 10 operator close-out pending**.

## Related summaries

- DB shape — [`../02-database/DATABASE_SUMMARY.md`](../02-database/DATABASE_SUMMARY.md)
- RAG sources + citation contract — [`../03-rag/RAG_SUMMARY.md`](../03-rag/RAG_SUMMARY.md)
- Local LLM + WASM — [`../04-ai-llm/LOCAL_LLM_AND_WASM.md`](../04-ai-llm/LOCAL_LLM_AND_WASM.md)
- RLS — [`../05-security/RLS_SECURITY_MODEL.md`](../05-security/RLS_SECURITY_MODEL.md)

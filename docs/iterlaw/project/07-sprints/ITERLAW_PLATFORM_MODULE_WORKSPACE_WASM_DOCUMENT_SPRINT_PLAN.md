# IterLaw Final Platform Architecture — Sprint Plan (Sprints 26–57)

**Status:** PLANNED / NOT STARTED. This document describes the **planned** final platform architecture for IterLaw and the **planned** sprint roadmap from Sprint 26 to Sprint 57. **No** sprint listed here has begun. **No** implementation is claimed. **No** production change is performed by this document.

Last updated: 2026-05-13.

---

## Scope of the final platform architecture (planned)

IterLaw is one modular legal AI platform. The following twenty-six target capabilities are **planned** across Sprints 26–57:

1. One IterLaw app, many legal modules.
2. Country + law module routing.
3. Module-based subscriptions.
4. Module-specific RAG.
5. Local-first answer stack.
6. Redis exact cache.
7. HNSW semantic cache.
8. `law_section_modules` registry.
9. `module_qa_cache` and `answer_generation_queue`.
10. Background pre-builder.
11. Ollama speed layer.
12. Structured legal answer generation.
13. Retrieval-augmented verification.
14. Speculative prefill UI.
15. Two-stage local model cascade.
16. Deterministic legal knowledge graph.
17. Streaming legal adviser UX.
18. Graceful failure and escalation.
19. WASM-native intelligence architecture.
20. User workspace model.
21. PostgreSQL RLS isolation.
22. Case management.
23. Supreme Controller.
24. Human approval queue.
25. Document intelligence engine.
26. DOCX / PDF / XLSX legal document rendering.

---

## Architectural invariants (apply to every sprint below)

- **Legal authority remains:** trusted legal sources + RAG provenance + deterministic rules + WASM safety gate + human review.
- **`citation_required = true`** for legal answers.
- **`zero_citation_answer_blocked = true`** for legal answers.
- **Trusted-source-only** legal answers — non-trusted sources cannot ground a legal answer.
- **`legal_review_queue`** preserved — uncertain, high-risk, or weak-citation answers route to human review.
- **No uncited legal answer** is shown as final.
- **No low-confidence legal answer** is shown as final.
- **No external LLM** in the orchestrator request path.
- **Private data uses PostgreSQL RLS.**
- **WASM** handles orchestration, routing, retrieval, policy, validation, and streaming. **Heavy LLM inference remains outside WASM.**

---

## Status legend used in this plan

- `PLANNED / NOT STARTED` — default for every sprint listed here.
- Any future state change (`IN PROGRESS`, `PASS FOR FOUNDATION ONLY`, `PASS`, `BLOCKED`) requires a captured evidence record under `reports/` and a matching update to [`./SPRINT_INDEX.md`](./SPRINT_INDEX.md).

---

## Sprint 26 — Speed-First Retrieval Infrastructure

- **Goal:** Establish HNSW-backed semantic retrieval + Redis exact cache as the speed-first tier on top of the offline-first legal DB model.
- **Scope:** HNSW index over module-scoped embeddings; Redis exact-key cache; hit / miss metrics; eviction policy; cache invalidation on corpus update.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/retrieval/hnsw/*`, `apps/legal-orchestrator/src/cache/redis_exact/*`, `infra/redis/*`, tests under `apps/legal-orchestrator/src/retrieval/__tests__/`, doc `docs/iterlaw/architecture/ITERLAW_SPEED_FIRST_RETRIEVAL.md`.
- **Acceptance gates:** offline-first hit rate measured on the seed corpus; exact-cache invalidation correctness; no cross-module bleed; no DSN / secret in logs.
- **Required tests:** unit tests for HNSW recall; cache invalidation tests; module-scoping tests; module-isolation tests.
- **Rollback notes:** feature-flag the speed tier off; orchestrator falls back to existing retrieval path.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; recall measurements captured under `reports/`; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 27 — Ollama Runtime Speed Layer

- **Goal:** Stabilise the Ollama runtime as the local inference speed layer for drafting and verification.
- **Scope:** Local Ollama process management; keep-alive; model warm-up; concurrency limits; failure surfacing.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/llm/ollama/*`, runbook `docs/iterlaw/operations/ITERLAW_OLLAMA_RUNTIME.md`.
- **Acceptance gates:** measured cold / warm latency; documented memory ceiling; no external network call from the runtime; SSH / firewall untouched.
- **Required tests:** transport tests against a local fake; warm-up smoke; concurrency cap tests.
- **Rollback notes:** disable runtime feature flag; orchestrator continues with existing local transport.
- **Evidence required before claiming PASS:** runbook updated; latency measurements captured; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 28 — Structured Fill-in-the-Blank Answering

- **Goal:** Replace freeform drafting with structured answer scaffolds that constrain the local LLM to fill verified slots only.
- **Scope:** Module-specific answer scaffolds; slot validators; refusal on slot-validation failure; integration with the citation gate.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/answer/scaffolds/*`, `apps/legal-orchestrator/src/answer/slots/*`, tests, doc `docs/iterlaw/architecture/ITERLAW_STRUCTURED_FILL_IN_THE_BLANK.md`.
- **Acceptance gates:** every slot is validated; failure → refusal; no uncited slot is rendered; `legal_review_queue` still routes weak answers.
- **Required tests:** slot validators; refusal-on-failure tests; citation-gate integration tests.
- **Rollback notes:** feature flag off; revert to current drafting path.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; sample refusal traces captured; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 29 — Retrieval-Augmented Verification

- **Goal:** Add a verification stage that re-grounds each filled slot against the retrieval result before the answer is finalised.
- **Scope:** Verifier model invocation pattern; slot-level re-grounding; mismatch → refusal / review.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/answer/verify/*`, tests, doc `docs/iterlaw/architecture/ITERLAW_RETRIEVAL_AUGMENTED_VERIFICATION.md`.
- **Acceptance gates:** every verified answer carries a verifier verdict; mismatches go to review; verifier never bypasses `citation_required`.
- **Required tests:** verifier-pass / verifier-fail tests; integration with the safety gate.
- **Rollback notes:** disable verifier flag; revert to direct drafting.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; verifier verdicts captured; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 30 — Speculative Prefill UI

- **Goal:** Speculative prefill of likely sub-questions in the UI while the user types, served from cache only.
- **Scope:** Client-side suggestion fetch; cache-only data source; cancellation; no LLM call on prefill; clear visual marking of cache-served content.
- **Files likely to be created/edited:** `apps/iterlaw-web/src/features/prefill/*`, `apps/legal-orchestrator/src/answer/prefill/*`, tests.
- **Acceptance gates:** prefill never triggers an LLM call; prefilled content is visually distinct from a verified answer; no analytics leak of sensitive text.
- **Required tests:** UI tests; cache-only enforcement test; cancellation test.
- **Rollback notes:** feature flag off in the UI.
- **Evidence required before claiming PASS:** UI test output; `git diff`; screenshots of prefill state under `reports/`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 31 — Two-Stage Local Model Cascade

- **Goal:** Two-stage cascade — small model drafts, larger model finalises only when confidence is low or stakes are high.
- **Scope:** Confidence scoring; escalation criteria; cost budget enforcement; cascade audit fields.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/answer/cascade/*`, tests, doc `docs/iterlaw/architecture/ITERLAW_TWO_STAGE_CASCADE.md`.
- **Acceptance gates:** cascade decisions are deterministic; no cascade bypasses the safety gate; cost-budget breach blocks the path.
- **Required tests:** cascade-decision unit tests; escalation tests; budget-breach tests.
- **Rollback notes:** feature flag off; single-stage path resumed.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; cascade traces captured; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 32 — Deterministic Legal Knowledge Graph

- **Goal:** Persist a deterministic legal knowledge graph linking statutes, sections, definitions, deadlines, and cited decisions.
- **Scope:** Graph schema; ingestion populator; query helpers; cross-references; effective-date edges.
- **Files likely to be created/edited:** SQL migrations under `db/migrations/`, `apps/legal-orchestrator/src/kg/*`, tests, doc `docs/iterlaw/architecture/ITERLAW_LEGAL_KNOWLEDGE_GRAPH.md`.
- **Acceptance gates:** every node carries provenance; every edge carries an effective date or version; nothing in the graph is inferred without source.
- **Required tests:** schema constraint tests; query helper tests; cross-reference invariants.
- **Rollback notes:** migrations are forward-only; rollback procedure documented in the operator runbook.
- **Evidence required before claiming PASS:** SQL migration apply output captured (Docker staging); typecheck / build / vitest; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 33 — ChatGPT-Style Streaming UX

- **Goal:** Stream the cited answer token-by-token to the UI while preserving the citation gate and the review queue.
- **Scope:** SSE endpoint; client streaming renderer; refusal-on-stream-mid-flight; partial-answer never finalised without citations.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/api/stream/*`, `apps/iterlaw-web/src/features/stream/*`, tests.
- **Acceptance gates:** a stream is finalised only after the citation check; if citations are missing at finalisation, the answer is replaced by a refusal; the stream never leaks an uncited claim as the final state.
- **Required tests:** stream finalisation tests; refusal-on-finalisation tests; SSE backpressure tests.
- **Rollback notes:** disable streaming flag; revert to non-streaming responses.
- **Evidence required before claiming PASS:** stream-trace captures; UI test output; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 34 — Graceful Failure and Escalation

- **Goal:** Define and implement graceful-failure paths for every retrieval / verification / generation failure with a clear escalation to human review.
- **Scope:** Failure taxonomy; user-facing failure copy; `legal_review_queue` routing; operator alerting (non-secret).
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/failure/*`, `apps/iterlaw-web/src/features/failure/*`, tests, doc `docs/iterlaw/architecture/ITERLAW_GRACEFUL_FAILURE_AND_ESCALATION.md`.
- **Acceptance gates:** every failure path emits a reason code; every legal-tinted failure routes to review; no fake "ok" state is rendered.
- **Required tests:** failure-taxonomy coverage tests; route-to-review tests.
- **Rollback notes:** failure copy reverts to existing strings.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; failure traces; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 35 — IterLaw WASM Runtime Foundation

- **Goal:** Stand up the WASM runtime foundation that will host orchestration, routing, retrieval, policy, validation, and streaming logic.
- **Scope:** Runtime host; module loader; sandbox memory and CPU limits; host-call permission model; no network from WASM by default.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/wasm_runtime/*`, tests, doc `docs/iterlaw/architecture/ITERLAW_WASM_RUNTIME_FOUNDATION.md`.
- **Acceptance gates:** WASM modules cannot open sockets unless explicitly granted; memory caps enforced; CPU caps enforced; failure modes documented.
- **Required tests:** runtime sandbox tests; permission-denied tests; OOM-handling tests.
- **Rollback notes:** runtime is opt-in; orchestrator continues to function without it.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; sandbox traces; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 36 — WASM Gateway and Security Layer

- **Goal:** WASM-hosted gateway and security layer that enforces auth, RLS-scoping, and policy on every legal-orchestrator request.
- **Scope:** Auth verification; RLS-scope assembly; per-route policy; rate limit hooks; audit envelope assembly.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/wasm_gateway/*`, tests, doc `docs/iterlaw/architecture/ITERLAW_WASM_GATEWAY_AND_SECURITY.md`.
- **Acceptance gates:** every request carries an auth + scope decision; every audit envelope is redacted (no DSN, no full prompt, no secret); failure modes block fail-closed.
- **Required tests:** auth-decision tests; scope-assembly tests; fail-closed tests.
- **Rollback notes:** gateway feature flag off; existing middleware remains.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; audit-envelope captures; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 37 — WASM Cache and Retrieval Engine

- **Goal:** Move cache lookup and retrieval routing into WASM, including HNSW and exact-cache adapters.
- **Scope:** WASM-hosted cache router; pluggable retrieval adapters; deterministic ordering; trust + freshness verdicts inside WASM.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/wasm_retrieval/*`, tests, doc `docs/iterlaw/architecture/ITERLAW_WASM_CACHE_AND_RETRIEVAL.md`.
- **Acceptance gates:** ordering is deterministic; trust + freshness verdicts are reproducible; no external network from WASM.
- **Required tests:** determinism tests; trust-ranking tests; freshness tests.
- **Rollback notes:** feature flag off; existing retrieval path resumes.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; determinism harness output; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 38 — WASM Intent and Complexity Classifier

- **Goal:** WASM-hosted intent + complexity classifier that decides cache hit / structured / cascade / refuse / review.
- **Scope:** Feature extraction; deterministic classifier; reason codes; integration with the safety gate.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/wasm_classifier/*`, tests, doc `docs/iterlaw/architecture/ITERLAW_WASM_INTENT_COMPLEXITY_CLASSIFIER.md`.
- **Acceptance gates:** classifier is deterministic; every decision carries reason codes; uncertain → review.
- **Required tests:** deterministic-replay tests; reason-code coverage tests.
- **Rollback notes:** feature flag off.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; replay traces; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 39 — WASM Legal Source Federation

- **Goal:** WASM-hosted federation across trusted legal sources within a module's scope.
- **Scope:** Source adapters (per trusted source); merge with deterministic ranking; provenance preserved end-to-end.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/wasm_federation/*`, tests, doc `docs/iterlaw/architecture/ITERLAW_WASM_LEGAL_SOURCE_FEDERATION.md`.
- **Acceptance gates:** every source result carries provenance; no non-trusted source can outrank an official source.
- **Required tests:** adapter contract tests; provenance preservation tests.
- **Rollback notes:** feature flag off.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; provenance traces; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 40 — WASM LLM Routing Layer

- **Goal:** WASM-hosted LLM routing layer that picks the local model based on intent, module, and budget. Inference itself remains outside WASM.
- **Scope:** Routing rules; budget tracking; refusal on budget breach; integration with cascade.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/wasm_llm_routing/*`, tests, doc `docs/iterlaw/architecture/ITERLAW_WASM_LLM_ROUTING.md`.
- **Acceptance gates:** no external LLM is selectable; budget breach blocks the path; routing decisions are auditable.
- **Required tests:** route-selection tests; budget-breach tests; no-external-LLM tests.
- **Rollback notes:** feature flag off.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; routing traces; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 41 — WASM External AI Federation

- **Goal:** Define a strictly-bounded, off-by-default federation interface for external AI services that **never** participates in the legal answer path.
- **Scope:** Interface specification; non-legal use-cases only (e.g., language-only translation, OCR pre-processing where allowed); explicit operator opt-in; auditing.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/wasm_external_federation/*`, doc `docs/iterlaw/architecture/ITERLAW_WASM_EXTERNAL_AI_FEDERATION.md`.
- **Acceptance gates:** interface refuses all legal-tinted calls; off by default; explicit policy required to enable; auditing is append-only.
- **Required tests:** legal-tinted-call rejection tests; default-off tests; policy-gated enable tests.
- **Rollback notes:** disable the interface; remove the policy.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; rejection traces; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 42 — WASM Synthesis and Validation Engine

- **Goal:** WASM-hosted synthesis (assembly of cited answer) + validation (citation, freshness, structure).
- **Scope:** Synthesis pipeline; validator passes; refusal on validation failure; integration with the streaming UX.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/wasm_synthesis/*`, `apps/legal-orchestrator/src/wasm_validation/*`, tests, doc `docs/iterlaw/architecture/ITERLAW_WASM_SYNTHESIS_AND_VALIDATION.md`.
- **Acceptance gates:** validation enforces `citation_required` and `zero_citation_answer_blocked`; failure → refusal / review; no uncited slot survives.
- **Required tests:** synthesis assembly tests; validation refusal tests; structure-violation tests.
- **Rollback notes:** feature flag off.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; refusal traces; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 43 — Streaming Legal Adviser Experience

- **Goal:** Full streaming legal adviser UX wired to WASM gateway + synthesis + validation + escalation paths.
- **Scope:** Client streaming with reason-code surfacing; clear "verified" vs "review" states; never finalise an uncited claim.
- **Files likely to be created/edited:** `apps/iterlaw-web/src/features/adviser/*`, `apps/legal-orchestrator/src/api/stream/*`, tests.
- **Acceptance gates:** every finalised state carries citations or a refusal; review state is unambiguous to the user; no PII in stream metadata.
- **Required tests:** end-to-end streaming tests; review-state tests.
- **Rollback notes:** feature flag off.
- **Evidence required before claiming PASS:** UI test output; sample traces; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 44 — WASM Observability and Cost Intelligence

- **Goal:** WASM-hosted observability and cost-intelligence layer covering retrieval, routing, synthesis, validation, and streaming.
- **Scope:** Metrics; structured traces; cost per request; alerts on cost / latency regressions.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/wasm_observability/*`, dashboards under `monitoring/`, tests.
- **Acceptance gates:** no secret leakage in metrics; cost is bounded per user / module; regression alerts route to the operator.
- **Required tests:** metric-shape tests; cost-cap tests; alert-routing tests.
- **Rollback notes:** disable the layer; existing logging remains.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; dashboard snapshots under `reports/`; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 45 — WASM Production Hardening

- **Goal:** Harden the WASM stack for production: sandbox limits, supply-chain checks, signed modules, replay-safe audit, kill-switches.
- **Scope:** Signed module loading; per-tenant kill-switch; replay-safe audit format; sandbox limit tuning.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/wasm_hardening/*`, tests, doc `docs/iterlaw/architecture/ITERLAW_WASM_PRODUCTION_HARDENING.md`.
- **Acceptance gates:** unsigned modules refused; kill-switch verified end-to-end; audit replay verified.
- **Required tests:** signature verification; kill-switch tests; audit replay tests.
- **Rollback notes:** disable the new hardening flags; previous behaviour resumes.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; hardening traces; `git diff`. **Does not authorise production.**
- **Status:** PLANNED / NOT STARTED.

## Sprint 46 — User Workspace and Subscription Foundation

- **Goal:** Introduce the user workspace and subscription model — country, module, plan combinations.
- **Scope:** `users`, `workspaces`, `subscriptions`, `country_module_plan` tables; signup / activate flow; per-module gating.
- **Files likely to be created/edited:** SQL migrations under `db/migrations/`, `apps/legal-orchestrator/src/workspace/*`, `apps/iterlaw-web/src/features/account/*`, tests.
- **Acceptance gates:** each paid module creates one workspace; gating is enforced at the orchestrator and at the UI; no cross-tenant data leakage.
- **Required tests:** entitlement tests; one-workspace-per-module test; cross-tenant access tests.
- **Rollback notes:** feature flag off; existing flows resume.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; migration apply (Docker staging); `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 47 — PostgreSQL RLS User Isolation

- **Goal:** Enforce PostgreSQL RLS on every private table across the workspace, case, document, and question-history surfaces.
- **Scope:** RLS policies; per-user JWT claim mapping; admin override audit; corpus stays RLS-off (already established).
- **Files likely to be created/edited:** SQL migrations; RLS policies; `apps/legal-orchestrator/src/db/rls/*`; tests including the existing C.1–C.5 test pattern under `docs/iterlaw/project/09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md`.
- **Acceptance gates:** RLS enabled on all private tables; corpus RLS off; fail-closed verified; admin override audited.
- **Required tests:** five-test RLS suite expanded to new tables; fail-closed tests.
- **Rollback notes:** forward-only migrations; rollback procedure documented.
- **Evidence required before claiming PASS:** migration apply output captured; SQL verification queries output; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 48 — Case Management Engine

- **Goal:** Add case management to the workspace — cases, deadlines, documents, history.
- **Scope:** `cases`, `case_deadlines`, `case_documents`, `case_history` tables; status machine; reminders surface only inside the workspace.
- **Files likely to be created/edited:** SQL migrations; `apps/legal-orchestrator/src/cases/*`; `apps/iterlaw-web/src/features/cases/*`; tests.
- **Acceptance gates:** every case is scoped to a workspace; deadlines never leak across tenants; reminders never imply legal advice.
- **Required tests:** case-scoping tests; deadline computation tests (deterministic only); reminder rendering tests.
- **Rollback notes:** feature flag off.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; migration apply; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 49 — Supreme Controller Foundation

- **Goal:** Introduce the Supreme Controller — the deterministic top-level orchestrator that selects module, scope, retrieval strategy, generation strategy, and review path for every request.
- **Scope:** Deterministic controller; reason codes; integration with WASM gateway, cache, retrieval, routing, synthesis, validation.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/supreme_controller/*`, tests, doc `docs/iterlaw/architecture/ITERLAW_SUPREME_CONTROLLER.md`.
- **Acceptance gates:** controller is deterministic; every decision is auditable; controller cannot bypass the safety gate or the review queue.
- **Required tests:** deterministic-replay tests; decision-graph coverage tests.
- **Rollback notes:** feature flag off.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; decision replays; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 50 — Human Approval Queue

- **Goal:** Implement the human approval queue used by `legal_review_queue` for legal-tinted draft answers and documents.
- **Scope:** Queue persistence; reviewer assignment; approval / refusal with reason codes; SLA tracking (non-blocking).
- **Files likely to be created/edited:** SQL migrations; `apps/legal-orchestrator/src/review_queue/*`; admin UI `apps/iterlaw-web/src/features/admin/review_queue/*`; tests.
- **Acceptance gates:** every legal-tinted draft routes through the queue when conditions are met; reviewer identity recorded; refusal preserved with reason; SLA visible to the operator only.
- **Required tests:** routing tests; reviewer-identity tests; refusal-traces tests.
- **Rollback notes:** feature flag off; review queue persists existing data.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; migration apply; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 51 — Quality and Self-Monitoring Agents

- **Goal:** Quality and self-monitoring agents that watch answer quality, citation coverage, freshness, and drift — read-only, evidence-emitting, never customer-facing.
- **Scope:** Quality metrics; citation coverage; freshness sampling; drift detection; operator alerts.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/quality_agents/*`, tests, doc `docs/iterlaw/architecture/ITERLAW_QUALITY_SELF_MONITORING.md`.
- **Acceptance gates:** agents do not mutate corpus, queues, or rules; they emit evidence records to `reports/`; alerts route to the operator.
- **Required tests:** metric-shape tests; non-mutation tests; alert-routing tests.
- **Rollback notes:** feature flag off.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; sample evidence records; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 52 — Document Intelligence Foundation

- **Goal:** Foundation of the document intelligence engine: parsing, citation alignment, structure extraction.
- **Scope:** DOCX / PDF / XLSX parsers (read-only); structure model; citation aligner; integration with the legal knowledge graph.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/doc_intel/*`, tests, doc `docs/iterlaw/architecture/ITERLAW_DOCUMENT_INTELLIGENCE_FOUNDATION.md`.
- **Acceptance gates:** parsing never executes embedded macros; every extracted claim carries provenance; structure is deterministic.
- **Required tests:** parser tests on fixtures; macro-rejection tests; deterministic-output tests.
- **Rollback notes:** feature flag off.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; fixture coverage; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 53 — Cited Legal Document Model

- **Goal:** Define the cited legal document model used for generation and approval.
- **Scope:** Schema for cited paragraphs; per-paragraph provenance; per-paragraph review state; refusal on uncited paragraph.
- **Files likely to be created/edited:** SQL migrations; `apps/legal-orchestrator/src/doc_intel/cited_model/*`; tests; doc `docs/iterlaw/architecture/ITERLAW_CITED_LEGAL_DOCUMENT_MODEL.md`.
- **Acceptance gates:** no document may finalise with an uncited paragraph; review state is preserved; provenance survives export.
- **Required tests:** schema invariants; uncited-paragraph refusal; export round-trip.
- **Rollback notes:** forward-only migrations; rollback documented.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; migration apply; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 54 — DOCX and PDF Rendering

- **Goal:** Render the cited document model to DOCX and PDF while preserving citation markers and review state.
- **Scope:** DOCX renderer; PDF renderer; deterministic output; size and resource limits; no remote font / image fetching.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/doc_intel/render/*`, tests on fixtures, doc `docs/iterlaw/architecture/ITERLAW_DOCX_PDF_RENDERING.md`.
- **Acceptance gates:** rendered documents preserve citations; no remote fetches; deterministic on the same input.
- **Required tests:** fixture render tests; determinism tests; resource-limit tests.
- **Rollback notes:** feature flag off.
- **Evidence required before claiming PASS:** rendered fixtures captured under `reports/`; typecheck, build, vitest output; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 55 — XLSX Legal Calculators

- **Goal:** XLSX-output legal calculators (deterministic) for redundancy, notice, holiday pay, NMW/NLW, statutory caps, etc.
- **Scope:** Deterministic calculators only; per-calculator citation; XLSX renderer; review-state-aware.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/doc_intel/calculators/*`, tests, doc `docs/iterlaw/architecture/ITERLAW_XLSX_LEGAL_CALCULATORS.md`.
- **Acceptance gates:** calculators never use LLM output; every output cell carries citation metadata; refusal on uncited cell.
- **Required tests:** deterministic-output tests; refusal-on-uncited-cell tests; XLSX render tests.
- **Rollback notes:** feature flag off.
- **Evidence required before claiming PASS:** rendered fixtures; typecheck, build, vitest output; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 56 — Document Approval and Solicitor Review

- **Goal:** Wire the human approval queue into the cited document model for solicitor / qualified reviewer approval before a document is final.
- **Scope:** Reviewer workflows; per-paragraph approval; reason codes for refusal; explicit "draft" vs "approved" surfaces.
- **Files likely to be created/edited:** `apps/legal-orchestrator/src/doc_intel/review/*`, admin UI extensions, tests.
- **Acceptance gates:** no document is presented as "approved" without a recorded reviewer identity and time; refusal preserved; draft state always visible to the user.
- **Required tests:** reviewer-identity tests; approval-state surface tests; refusal-trace tests.
- **Rollback notes:** feature flag off; existing draft state remains.
- **Evidence required before claiming PASS:** typecheck, build, vitest output; approval traces; `git diff`.
- **Status:** PLANNED / NOT STARTED.

## Sprint 57 — Full Workspace UX

- **Goal:** Final workspace UX bringing together cases, documents, deadlines, questions, review queue, and approval surfaces.
- **Scope:** Navigation; tenant scoping; accessibility; consistent reason-code surfacing; clear "draft" / "verified" / "review" markers throughout.
- **Files likely to be created/edited:** `apps/iterlaw-web/src/features/workspace/*`, tests, doc `docs/iterlaw/architecture/ITERLAW_FULL_WORKSPACE_UX.md`.
- **Acceptance gates:** all surfaces enforce RLS at the UI; no cross-tenant artefact appears; no uncited legal claim is rendered as final; no low-confidence answer is rendered as final.
- **Required tests:** UI tests; cross-tenant visibility tests; reason-code surfacing tests.
- **Rollback notes:** feature flag off; previous workspace UX resumes.
- **Evidence required before claiming PASS:** UI test output; screenshots under `reports/`; `git diff`.
- **Status:** PLANNED / NOT STARTED.

---

## Closing notes

- Every sprint above is **PLANNED / NOT STARTED**.
- No sprint above is implemented, deployed, or production-ready.
- No sprint above weakens `citation_required`, `zero_citation_answer_blocked`, `legal_review_queue`, the trusted-source ranking, the effective-date filter, or the WASM / policy gate.
- Heavy LLM inference remains outside WASM. WASM owns orchestration, routing, retrieval, policy, validation, and streaming.
- All private data uses PostgreSQL RLS.
- All legal answers and documents require citations. Low-confidence answers / documents route to the human approval queue.

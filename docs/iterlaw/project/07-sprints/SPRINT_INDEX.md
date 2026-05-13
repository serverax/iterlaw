# Sprint Index

Authoritative pointer to sprint status. Full long-form roadmap: `docs/iterlaw/ITERLAW_SPRINT_ROADMAP.md`. Project status: [`../ITERLAW_PROJECT_STATUS.md`](../ITERLAW_PROJECT_STATUS.md).

## Current verified gate state

- Sprint 10 code-side migration verification: **PASS**.
- Sprint 10 real Docker staging DB replay: **PASS** (2026-05-13, container `iterlaw-staging-postgres` from `pgvector/pgvector:pg16`; see `reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md`). **Not** AKS staging, **not** production, **not** the live operator staging DB.
- Sprint 10 overall: **PASS** (Docker staging scope). The non-Docker staging targets remain a separate operator decision.
- Sprint 11: **PASS** — Phase 2B (live local HTTP transport, commit `3681fab`) + Phase 4 (pipeline wiring of `runLocalDraftingStep` into `handleLegalRequest`, commit `120b9de`) both implemented and tested. Production unblock is **NOT** claimed by Sprint 11; first live backup remains the separate gate.
- Sprint 12: **PASS FOR DRY-RUN FOUNDATION ONLY** — live backup + live restore NOT EXECUTED.
- Sprint 13: **PASS FOR OPERATOR-WORKSTATION READINESS ONLY** — first live backup remains NOT AUTHORISED.
- Sprint 14: **PASS FOR INTELLIGENCE FOUNDATION / CODE-PREPARED ONLY** — not wired into the answer path.
- Sprint 15: **PASS FOR FEATURE-FLAGGED LOCAL WIRING ONLY** — Intelligence Layer disabled by default.
- Sprint 12A (this audit-reconciliation sprint): **PASS** for `SPRINT_INDEX` truth reconciliation, source-header corrections, and Windows-bash test resolver.
- Production: **BLOCKED**.

### Sprint 10 migration replay blockers fixed and replayed

- Migration 100 compatibility shim landed in commit `21364f4`.
- Migration 102 compatibility shim landed in commit `c17ffc2`.
- Static / code verification: typecheck PASS, build PASS, vitest **55 files / 708 tests PASS**.
- Real Docker staging DB replay executed by `scripts/operator/sprint10-docker-staging-replay.ps1` on 2026-05-13: all migrations applied, extensions verified, key tables present, RLS enabled where expected, policies present, smoke counts captured, orchestrator `/ready` returned `rag.configured=true`, `rag.mode=postgres`, `rag.database=configured`, `legal_safety.citation_required=true`, `legal_safety.zero_citation_answer_blocked=true`. No DSN / password leaked in `/ready` or in any committed artefact.
- QA evidence: `reports/ITERLAW_QA_REPORT_SPRINT_10_MIGRATION_102_COMPATIBILITY_FIX.md` + `reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md`.

## Sprint count

- **Total roadmap:** **57 sprints**.
- **Completed:** **15** (Sprints 1–11 PASS; Sprint 12 PASS-for-dry-run-foundation; Sprint 13 PASS-for-operator-workstation-readiness; Sprint 14 PASS-for-intelligence-foundation; Sprint 15 PASS-for-feature-flagged-local-wiring; plus correction Sprint 12A).
- **Current:** **Sprint 16** (planned start).
- **Remaining:** **42**.
- **Remaining range:** **Sprint 16 → Sprint 57.**
- Sprint 10: **PASS** — Docker staging verification passed (`reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md`).
- Sprint 11: **PASS** — Phase 1 + Phase 2A + hardening tests + Phase 2B (live local HTTP transport, commit `3681fab`) + Phase 4 (pipeline wiring of `runLocalDraftingStep` into `handleLegalRequest`, commit `120b9de`) all green. Full suite **58 files / 763 tests PASS**. Closeout QA report: [`../11-ai-governance/SPRINT_11_PHASE_2B_4_QA_REPORT.md`](../11-ai-governance/SPRINT_11_PHASE_2B_4_QA_REPORT.md). ADR: [`../11-ai-governance/ADR_SPRINT_11_LOCAL_LLM_TRANSPORT_AND_PIPELINE_WIRING.md`](../11-ai-governance/ADR_SPRINT_11_LOCAL_LLM_TRANSPORT_AND_PIPELINE_WIRING.md).
- Sprint 12: **PASS FOR DRY-RUN FOUNDATION ONLY** — Track B operator-side backup + restore-verify scripts, manifest validator, restore-target validator, 39 new vitest tests, runbook, ADR. Full suite **59 files / 802 tests PASS** (commits `a750f88` → `fdafca3`). Live backup + live restore **NOT EXECUTED**. Track A (cluster Borg path) **unchanged**. Closeout QA report: [`../12-backup-go-live/SPRINT_12_BACKUP_GO_LIVE_QA_REPORT.md`](../12-backup-go-live/SPRINT_12_BACKUP_GO_LIVE_QA_REPORT.md).
- Sprint 13: **PASS FOR OPERATOR-WORKSTATION READINESS ONLY** — `--check` toolchain probes on both Track B scripts, operator toolchain doc (Windows/Linux/macOS), first-live-backup authorisation checklist (default NO), 25 new vitest tests. Full suite **61 files / 827 tests PASS** (commits `45a10e3` → `ba3a586` + Sprint 13 QA). First live backup + live restore **NOT AUTHORISED**.
- Sprint 14: **PASS FOR INTELLIGENCE FOUNDATION / CODE-PREPARED ONLY** — 11 intelligence modules + 54 tests + 6 architecture docs (commits `5470757`, `427e8ff`, `b53fa9a`). Not wired.
- Sprint 15: **PASS FOR FEATURE-FLAGGED LOCAL WIRING ONLY** — feature flag config + shadow-mode wiring + `/ready` additive field + 26 new tests. Full suite **72 files / 907 tests PASS**. Intelligence Layer disabled by default.
- Sprint 16: **PLANNED**.
- Sprints 17–57: **PLANNED.**
- Production: **BLOCKED.**

## Sprint 11 — Local LLM Gateway + Cited RAG Answer Path

**Status:** **PASS** (closed). Phase 1 + Phase 2A + hardening + Phase 2B (commit `3681fab`) + Phase 4 (commit `120b9de`) all implemented and tested. Sprint 11 is NOT a production-unblock sprint — first live backup, live restore, and production deployment remain gated by their own sprints.

**Delivered:**

- Local LLM gateway with injected transport only — no external provider calls.
- Cited RAG answer path (Postgres mode when `DATABASE_URL` is configured; mock when not).
- Deterministic legal gates (PII → risk → deadline → citation → policy → rule checks) run before any LLM call; LLM cannot override any gate.
- Redacted audit envelope per request (no DSN / no raw prompt / no full answer body).
- API response envelope standardised across all refusal / `ok` statuses.

Sprint 11 task contract: [`./SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md`](./SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md).
Earlier planning docs (foundation phase): [`./SPRINT_11_LOCAL_LLM_GATEWAY_AND_TRANSPORT_POLICY.md`](./SPRINT_11_LOCAL_LLM_GATEWAY_AND_TRANSPORT_POLICY.md) + [`./SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md`](./SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md) + [`./SPRINT_11_IMPLEMENTATION_CHECKLIST.md`](./SPRINT_11_IMPLEMENTATION_CHECKLIST.md).

Governance: every Sprint 11 model / prompt / routing / transport-policy change is reviewed under [`../11-ai-governance/SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md`](../11-ai-governance/SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md).


## Current state

| Sprint | Title | Status | Evidence |
| --- | --- | --- | --- |
| 1–8 | Foundation (repo + orchestrator + safety gates + WASM rule-runner + module pipeline + RAG DB foundation + ingestion framework + readiness/retrieval injection) | **DONE** | Commits + tests + verifiers. |
| 9 | Rename cleanup + backup safety baseline | **DONE** | `@rightsnow/*` → `@iterlaw/*`; LF policy; backup uploader + sealed-secret workflow; `legal_cases` (102). |
| 10 | Live RAG retrieval + corpus ingestion + DB user-workspace + RLS | **PASS** (Docker staging scope) — local Docker DB migration-chain verification PASS (2026-05-13, `pgvector/pgvector:pg16`, full forward chain applied; report `reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md`). AKS staging + production verification remain a separate operator decision. | See [`SPRINT_10_DB_DECISIONS.md`](SPRINT_10_DB_DECISIONS.md) + [`../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md`](../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md) + `reports/ITERLAW_QA_REPORT_SPRINT_10_DB_IMPLEMENTATION.md` + `reports/ITERLAW_SPRINT_10_STAGING_APPLY_2026-05-13.md` |
| 11 | Local LLM gateway + cited RAG answer path | **PASS** — Phase 1 foundation + Phase 2A audit/transport guardrails + Sprint 11 hardening tests + Phase 2B (live local HTTP transport, commit `3681fab`) + Phase 4 (pipeline wiring of `runLocalDraftingStep` into `handleLegalRequest`, commit `120b9de`) all green. Full suite **58 files / 763 tests PASS** at Sprint 11 close. Sprint 11 does NOT unblock production. | See [`SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md`](SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md) + [`../11-ai-governance/SPRINT_11_PHASE_2B_4_QA_REPORT.md`](../11-ai-governance/SPRINT_11_PHASE_2B_4_QA_REPORT.md) + [`../11-ai-governance/ADR_SPRINT_11_LOCAL_LLM_TRANSPORT_AND_PIPELINE_WIRING.md`](../11-ai-governance/ADR_SPRINT_11_LOCAL_LLM_TRANSPORT_AND_PIPELINE_WIRING.md) |
| 12 | Backup go-live | **PASS FOR DRY-RUN FOUNDATION ONLY** | Track B operator-side scripts (`scripts/backup/*`), manifest + sha256 + isolated-target validators, 39 vitest tests, runbook, ADR. Live backup + live restore NOT EXECUTED. Track A (cluster Borg path) unchanged. Closeout QA: [`../12-backup-go-live/SPRINT_12_BACKUP_GO_LIVE_QA_REPORT.md`](../12-backup-go-live/SPRINT_12_BACKUP_GO_LIVE_QA_REPORT.md). |
| 13 | Backup MVP polish + operator readiness | **PASS FOR OPERATOR-WORKSTATION READINESS ONLY** | `--check` toolchain probes on both Track B scripts; operator toolchain doc (Windows / Linux / macOS); first-live-backup authorisation checklist (default NO); 25 new vitest tests; ADR. First live backup + live restore NOT AUTHORISED. Closeout QA: [`../13-backup-mvp-polish/SPRINT_13_BACKUP_MVP_POLISH_QA_REPORT.md`](../13-backup-mvp-polish/SPRINT_13_BACKUP_MVP_POLISH_QA_REPORT.md). |
| 14 | Intelligence Layer foundation | **PASS FOR INTELLIGENCE FOUNDATION / CODE-PREPARED ONLY** | 11 pure-function modules under `apps/legal-orchestrator/src/intelligence/`; 7 test files (54 tests); 6 architecture docs under `docs/iterlaw/architecture/`. Not wired into answer path by this sprint. Commits `5470757`, `427e8ff`, `b53fa9a`. |
| 15 | Intelligence Layer feature-flagged wiring | **PASS FOR FEATURE-FLAGGED LOCAL WIRING ONLY** | Feature flag config (`ITERLAW_INTELLIGENCE_LAYER_ENABLED` / `_MODE`, default off); shadow-mode wiring of `runIntelligenceGateway` in `handleLegalRequest` (intentional PARTIAL ACTIVE wiring; gateway result discarded); `/ready` additive `intelligence_layer` field; 26 new vitest tests. Full suite **72 files / 907 tests PASS**. Intelligence Layer disabled by default; first live backup + live restore remain NOT AUTHORISED. ADR: [`../15-intelligence-layer-wiring/ADR_SPRINT_15_INTELLIGENCE_LAYER_FEATURE_FLAGGED_WIRING.md`](../15-intelligence-layer-wiring/ADR_SPRINT_15_INTELLIGENCE_LAYER_FEATURE_FLAGGED_WIRING.md). |
| 12A | Audit reconciliation + Windows bash test fix (correction sprint) | **PASS** | `SPRINT_INDEX.md` contradictions reconciled; stale source headers in `handleLegalRequest.ts` + `runLocalDraftingStep.ts` corrected; `resolveBash.ts` helper + `resolveBash.test.ts` added; Sprint 12 + Sprint 13 bash-using tests now resolve bash via `BASH_PATH` / PATH / common Git Bash locations and fail loudly instead of silently skipping. Full suite **73 files / 912 tests PASS**. Audit report retained at `reports/CURSOR_AUDIT_CLAUDE_SPRINT_11_12_QA_REPORT.md`. |
| 16 | MVP polish + smoke test | Planned | Web UI, end-to-end cited answer against seeded corpus. |
| 17 | Member / auth / subscription foundation | Planned | Local-first auth path; tiered rate limits. |
| 18 | Admin / legal-review UI | Planned | Human-in-the-loop review pipeline. |
| 19 | Live evolution + safe optimisation | Planned | `docs/iterlaw/SPRINT_16_LIVE_EVOLUTION_AND_SAFE_OPTIMISATION_PLAN.md`. **HITL approval required for every prompt / rule change.** |
| 20 | UK GDPR / DPA 2018 / Data (Use and Access) Act 2025 retention + consent | Planned | Retention enforcement job; consent ledger. |
| 21 | Multimodal evidence grounding beta *(legacy entry; superseded by the post-core roadmap below)* | Planned (future backlog) | `docs/iterlaw/SPRINT_18_MULTIMODAL_EVIDENCE_GROUNDING_BETA_PLAN.md`. DPIA-gated; local-only; pilot capped at 5 users. |
| 22 | Production hardening + public launch | Planned | Load test, SLO, on-call rota, ingress TLS plan complete. |

## Post-core roadmap (Sprints 18–57 — target architecture)

The full multi-country / multi-domain platform roadmap is in [`ROADMAP_REMAINING_SPRINTS.md`](ROADMAP_REMAINING_SPRINTS.md). It covers the Law Module Engine (18–25), speed-first retrieval (26–34), the WASM intelligence stack (35–45), workspace + RLS + Supreme Controller + approval queue (46–51), and the document intelligence stack (52–57).

These are roadmap entries, not committed delivery. They land **after** first IterLaw beta (UK Employment) is shipped. The legacy Sprint 18 / 19 entries above remain valid until they are folded into the new numbering during a future planning sprint.

### Sprints 26–57 status (PLANNED only — addendum 2026-05-13)

Every sprint numbered 26 through 57 is **PLANNED**. None is implemented. None is claimed complete. This addendum re-affirms the PLANNED designation for the full Sprint 26–57 range and is the canonical statement used by the top-level [`../../ITERLAW_SPRINT_ROADMAP.md`](../../ITERLAW_SPRINT_ROADMAP.md) addendum and by [`../../../PROJECT.md`](../../../PROJECT.md).

- **26–34** Speed-first retrieval infrastructure (HNSW + cache, Ollama runtime layer, structured fill-in-the-blank, retrieval-augmented verification, speculative prefill, two-stage cascade, knowledge graph, SSE streaming, graceful failure) — all **PLANNED**.
- **35–45** WASM intelligence stack (runtime foundation, gateway/security, cache/retrieval router, classifier, source federation, LLM routing, external-AI federation interface, synthesis/validation, streaming experience, observability/cost, production hardening) — all **PLANNED**.
- **46–51** Workspace, RLS, Supreme Controller, approval (subscription foundation, RLS isolation, case management, controller foundation, approval queue, quality/self-monitoring agents) — all **PLANNED**.
- **52–57** Document intelligence stack (foundation, cited document model, DOCX/PDF, XLSX calculators, approval / solicitor review, full workspace UX) — all **PLANNED**.

## Offline-first legal DB model — mandatory roadmap constraint

The offline-first legal DB model is now a locked architectural decision — see [`../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`](../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md) and [`../01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md`](../01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md).

- **Offline-first is mandatory**, not optional. Every future-sprint deliverable that touches the answer path must serve from the local DB / cache / section registry / knowledge graph before considering the LLM.
- **Each country engine requires its own offline legal DB** before that country can launch. No country goes live without its DB built + human-reviewed seed rows.
- **LLM fallback / background builder is a later layer**, not the first answer path. Sprint 27+ optimisations are applied **after** the offline-first tier infrastructure is in place.
- **Sprints 18–25** must be aligned to this offline-first DB model — Law Module Engine, section registry, Q&A cache, generation queue, country expansion engine, module-specific AI isolation, knowledge seeding, persistent legal memory.
- **Sprints 26–34** optimise speed / streaming **on top of** the offline-first model — HNSW, keep-alive, structured fill-in-the-blank, RAV, speculative prefill, two-stage cascade, knowledge graph, SSE, graceful failure.
- **Sprints 35–45** apply WASM to the offline-first engine — gateway, cache, retrieval router, classifier, legal sources, LLM routing, synthesis, streaming, observability, hardening.

No future sprint is marked complete by this docs update.

## Sprint 10 close-out — what's pending

Operator-side action required (no agent will perform these). Authoritative procedure: [`../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md`](../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md).

Summary:

1. Apply migrations `104` / `105` / `106` on a confirmed **dev / staging** DB (after the existing `000 → 010, 101, 102` chain). Production-host refusal guard in checklist §0 + §2.
2. Run the 5 SQL verification queries (checklist §3–§7): tables exist, indexes exist, RLS policies exist, `relrowsecurity = t` on user-data tables, `relrowsecurity = f` on corpus.
3. Run the 5 RLS test cases (checklist §8 C.1–C.5): user-A-vs-B isolation, fail-closed, solicitor scoping, admin override, child-table inheritance.
4. Run `bash scripts/infra/verify-iterlaw-rag-db.sh` with `DATABASE_URL` set; expect previously `NOT EXECUTED` live-DB checks to flip to `PASS`.
5. Capture the sign-off block (checklist §12) into `reports/ITERLAW_SPRINT_10_STAGING_APPLY_<YYYY-MM-DD>.log`.
6. On all-PASS, update this index + `SPRINT_10_DB_DECISIONS.md` per checklist §13.

## How to find the latest QA report

`reports/ITERLAW_QA_REPORT_SPRINT_10_DB_IMPLEMENTATION.md` is the latest Sprint 10 evidence artefact at the time of writing. Always check `reports/` for newer reports before claiming a status.

## IterLaw AI Agent Operating Model / Agent Factory Track (IA)

**Track status:** NOT STARTED. This is a planning + governance track. **No IA sprint has begun.** No agents are running. No LangGraph / CrewAI / Dify / n8n / Haystack / OpenHands runtime has been installed. No K3s, firewall, SSH, or production change has been made for this track. Production readiness is **NOT** claimed.

Authoritative documents for this track:

- Operating model: [`../../architecture/ITERLAW_AI_AGENT_OPERATING_MODEL.md`](../../architecture/ITERLAW_AI_AGENT_OPERATING_MODEL.md).
- Hard rules: [`../11-ai-governance/ITERLAW_AGENT_GOVERNANCE_RULES.md`](../11-ai-governance/ITERLAW_AGENT_GOVERNANCE_RULES.md).
- Security boundaries: [`../../security/ITERLAW_AGENT_SECURITY_BOUNDARIES.md`](../../security/ITERLAW_AGENT_SECURITY_BOUNDARIES.md).
- Before / after architecture: [`../../architecture/ITERLAW_BEFORE_AFTER_AGENT_ARCHITECTURE.md`](../../architecture/ITERLAW_BEFORE_AFTER_AGENT_ARCHITECTURE.md).
- Sprint plan: [`./ITERLAW_AGENT_FACTORY_SPRINT_PLAN.md`](./ITERLAW_AGENT_FACTORY_SPRINT_PLAN.md).

| IA Sprint | Title | Status | Evidence |
| --- | --- | --- | --- |
| IA-1 | Agent operating model docs | **NOT STARTED** | Planning doc only. No PASS recorded. |
| IA-2 | Agent registry and role definitions | **NOT STARTED** | None. |
| IA-3 | Task queue and evidence model | **NOT STARTED** | None. |
| IA-4 | LangGraph workflow prototype | **NOT STARTED** | None. |
| IA-5 | CrewAI sandbox team prototype | **NOT STARTED** | None. |
| IA-6 | RAG / Ingestion agent design | **NOT STARTED** | None. |
| IA-7 | QA / Audit agent implementation | **NOT STARTED** | None. |
| IA-8 | Security agent discovery-only checks | **NOT STARTED** | None. |
| IA-9 | Marketing / documentation agent sandbox | **NOT STARTED** | None. |
| IA-10 | DevOps agent read-only K3s checks | **NOT STARTED** | None. |
| IA-11 | Approval gate and risk classifier | **NOT STARTED** | None. |
| IA-12 | Agent dashboard / admin UI | **NOT STARTED** | None. |
| IA-13 | Integration with OrdinoxAI management layer | **NOT STARTED** | None. |
| IA-14 | Production readiness review | **NOT STARTED** | None. |

Track invariants (carry through every IA sprint):

- Agents are helpers / workers. They are **not** the legal authority.
- `citation_required` and `zero_citation_answer_blocked` remain **on** in every environment.
- `legal_review_queue` and trusted-source-only retrieval are preserved.
- No external LLM calls in the orchestrator request path.
- No production deploy, no K3s mutation, no firewall mutation, no SSH change, no port exposure, no secret addition by an agent.
- No PASS / DONE for an IA sprint without a captured QA / Audit evidence record under `reports/`.

## How to declare a sprint DONE

A sprint is DONE only when:

- All in-scope tests pass (with command output recorded).
- Verifiers pass (with command output recorded).
- The relevant operator action (apply / pin / seal / drill / launch) has been performed and evidenced.
- The status in this index is updated.
- The sprint's plan file in `docs/iterlaw/SPRINT_*_PLAN.md` carries a "DONE" header.

No agent declares DONE without all four. See [`../08-qa/QA_PROCESS.md`](../08-qa/QA_PROCESS.md).

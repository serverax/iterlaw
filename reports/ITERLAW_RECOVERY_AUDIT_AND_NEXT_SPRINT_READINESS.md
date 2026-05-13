# IterLaw Recovery Audit and Next-Sprint Readiness Report

**Scope:** Recovery audit after revert of two prior-session docs commits. Read-only sprint-readiness assessment. No commits, no pushes, no deploys made by this report.
**Project:** IterLaw only. **Path:** `C:\Users\kalsh\projects\iterlaw`. **Branch:** `master`. **Remote:** `https://github.com/serverax/iterlaw.git`.
**Date:** 2026-05-13.

---

## STATUS: PARTIAL

**Why PARTIAL (not PASS):** the repo is internally consistent on sprint 1–15 status and tests are green, BUT two pre-existing-from-prior-sessions inconsistencies remain visible in the codebase:

1. `docs/iterlaw/project/07-sprints/ROADMAP_REMAINING_SPRINTS.md` is stale relative to `SPRINT_INDEX.md` (says Sprint 10 PENDING / Sprint 11 BLOCKED; SPRINT_INDEX says both PASS). See §3.
2. `apps/web/lib/ai/claude.ts` + `apps/web/lib/ai/gemini.ts` + `apps/web/lib/ai/orchestrate.ts` make **direct calls to external LLM providers** (`api.anthropic.com`, Gemini). These are outside the `apps/legal-orchestrator` Sprint 11 transport policy. See §5.

Neither issue was introduced by this session. Both are pre-existing. Flagging for awareness.

---

## 1. Repo state (Phase 1)

```
git status -sb
## master...origin/master
?? reports/CURSOR_AUDIT_CLAUDE_SPRINT_11_12_QA_REPORT.md
```

```
git branch --show-current
master
```

```
git remote -v
origin	https://github.com/serverax/iterlaw.git (fetch)
origin	https://github.com/serverax/iterlaw.git (push)
```

```
git log --oneline -10
d49ffeb Revert "docs(iterlaw): add AI agent operating model and governance track"
7204673 Revert "docs(iterlaw): add platform workspace WASM sprint roadmap"
3605762 docs(iterlaw): add platform workspace WASM sprint roadmap
4364c3b docs(iterlaw): add AI agent operating model and governance track
b9084ee audit(iterlaw): deep project verification and security fixes
ea11ffa docs(iterlaw): reconcile sprint index contradictions + sprint 12A QA
12e4c6f docs(orchestrator): correct stale source-file headers (sprint 12A)
eaa7e6a test(orchestrator): resolve bash on Windows + strengthen active-mode guard
ae661cf docs(iterlaw): update project status for sprint 15
04fc74d docs(iterlaw): record sprint 15 intelligence wiring policy and QA
```

**Findings:**

- Current branch: `master`.
- Current HEAD: `d49ffeb`.
- Ahead/behind: **even** with `origin/master`.
- Working tree: clean **except** the pre-existing untracked file `reports/CURSOR_AUDIT_CLAUDE_SPRINT_11_12_QA_REPORT.md` (per operator instruction this file is left untouched).
- No other untracked or modified files. **VERIFIED.**

---

## 2. Rollback verification (Phase 2)

```
git show --stat --oneline d49ffeb
d49ffeb Revert "docs(iterlaw): add AI agent operating model and governance track"
 .../ITERLAW_AI_AGENT_OPERATING_MODEL.md            | 221 ---------------------
 .../ITERLAW_BEFORE_AFTER_AGENT_ARCHITECTURE.md     | 167 ----------------
 .../ITERLAW_AGENT_FACTORY_SPRINT_PLAN.md           | 215 --------------------
 docs/iterlaw/project/07-sprints/SPRINT_INDEX.md    |  38 ----
 .../ITERLAW_AGENT_GOVERNANCE_RULES.md              | 117 -----------
 .../security/ITERLAW_AGENT_SECURITY_BOUNDARIES.md  | 161 ---------------
 6 files changed, 919 deletions(-)

git show --stat --oneline 7204673
7204673 Revert "docs(iterlaw): add platform workspace WASM sprint roadmap"
 PROJECT.md                                         |  19 -
 ...M_MODULE_WORKSPACE_WASM_DOCUMENT_SPRINT_PLAN.md | 425 ---------------------
 docs/iterlaw/project/07-sprints/SPRINT_INDEX.md    |  55 ---
 3 files changed, 499 deletions(-)
```

**Test-Path results (PowerShell):**

| Path | Exists |
|---|---|
| `docs/iterlaw/security/ITERLAW_AGENT_SECURITY_BOUNDARIES.md` | **False** |
| `docs/iterlaw/architecture/ITERLAW_BEFORE_AFTER_AGENT_ARCHITECTURE.md` | **False** |
| `docs/iterlaw/architecture/ITERLAW_AI_AGENT_OPERATING_MODEL.md` | **False** |
| `docs/iterlaw/project/11-ai-governance/ITERLAW_AGENT_GOVERNANCE_RULES.md` | **False** |
| `docs/iterlaw/project/07-sprints/ITERLAW_AGENT_FACTORY_SPRINT_PLAN.md` | **False** |
| `docs/iterlaw/project/07-sprints/ITERLAW_PLATFORM_MODULE_WORKSPACE_WASM_DOCUMENT_SPRINT_PLAN.md` | **False** |

**Rollback effect:** all six prior-session-added doc files are removed. `SPRINT_INDEX.md` and `PROJECT.md` are restored to their pre-session content (no IA-track section, no Sprints 26–57 Planned Platform Architecture section, no Final Platform Architecture section). **VERIFIED.**

---

## 3. Current sprint index status (Phase 3)

`Get-ChildItem docs/iterlaw/project/07-sprints -File`:

```
Name                                                Length LastWriteTime
ROADMAP_REMAINING_SPRINTS.md                          9225 5/13/2026 3:04:47 AM
SPRINT_10_DB_DECISIONS.md                             4558 5/12/2026 10:43:54 PM
SPRINT_10_STAGING_DB_OPERATOR_RUNBOOK.md             25950 5/13/2026 3:04:59 AM
SPRINT_11_CLOSEOUT_IMPLEMENTATION_PLAN.md            14925 5/13/2026 5:32:38 AM
SPRINT_11_IMPLEMENTATION_CHECKLIST.md                 5202 5/12/2026 10:06:34 PM
SPRINT_11_LOCAL_LLM_GATEWAY_AND_TRANSPORT_POLICY.md   5895 5/13/2026 12:06:13 AM
SPRINT_11_LOCAL_LLM_GATEWAY_PLAN.md                   8684 5/12/2026 10:06:12 PM
SPRINT_11_LOCAL_LLM_RAG_GATEWAY_TASKS.md             12170 5/13/2026 4:16:01 AM
SPRINT_14_INTELLIGENCE_LAYER_PLAN.md                  6103 5/13/2026 7:01:47 AM
SPRINT_INDEX.md                                      17502 5/13/2026 6:26:05 PM
```

### 3.1 Sprint statuses recorded in `SPRINT_INDEX.md`

| Sprint | Title | Status |
|---|---|---|
| 1–9 | Foundation | **DONE** |
| 10 | Live RAG retrieval + corpus ingestion + DB user-workspace + RLS | **PASS** (Docker staging scope) |
| 11 | Local LLM gateway + cited RAG answer path | **PASS** |
| 12 | Backup go-live | **PASS FOR DRY-RUN FOUNDATION ONLY** |
| 12A | Audit reconciliation + Windows bash test fix | **PASS** |
| 13 | Backup MVP polish + operator readiness | **PASS FOR OPERATOR-WORKSTATION READINESS ONLY** |
| 14 | Intelligence Layer foundation | **PASS FOR INTELLIGENCE FOUNDATION / CODE-PREPARED ONLY** |
| 15 | Intelligence Layer feature-flagged wiring | **PASS FOR FEATURE-FLAGGED LOCAL WIRING ONLY** |
| 16 | (planned start) | **PLANNED** |
| 17–57 | (roadmap) | **PLANNED** |
| Production | — | **BLOCKED** |

### 3.2 Cross-document consistency

- `PROJECT.md` (root): aligned with SPRINT_INDEX (Sprint 16 current, sprints 1–15 PASS / partial-PASS, sprints 16–57 PLANNED).
- `docs/iterlaw/ITERLAW_PROJECT_STATUS.md` (mirror): aligned with SPRINT_INDEX.
- `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md` (canonical): **internally contradictory**. Top "Current verified gate state" header says `Sprint 11: UNBLOCKED / READY TO START — Phase 2B + Phase 4 NOT STARTED`; later "Sprint count" section says `Sprint 11: PASS — Phase 1 + Phase 2A + Phase 2B + Phase 4 ... 58 files / 763 tests PASS`. The body section is current; the top section is stale.
- `docs/iterlaw/project/07-sprints/ROADMAP_REMAINING_SPRINTS.md`: **stale**. Says `Sprint 10 status: PENDING (post-fix re-run required after commit c17ffc2)` and `Sprint 11 Phase 1 + Phase 2A: PASS (mock-safe); Sprint 11 live HTTP transport: NOT STARTED; Sprint 11 pipeline wiring: NOT STARTED; Production: BLOCKED.` This was correct at the time of writing but does not reflect the Sprint 10 Docker-staging replay PASS or Sprint 11 Phase 2B + Phase 4 completion recorded elsewhere.

### 3.3 Sprint 26

- Sprint 26 is **NOT** an active sprint in `SPRINT_INDEX.md`.
- It appears as a **planned future entry** in `ROADMAP_REMAINING_SPRINTS.md` under "Speed-first retrieval infrastructure (26–34)".
- It also appears in `PROJECT.md` under "Planned (26–34 — Speed-first retrieval infrastructure)" as `**26** Speed-First Retrieval Infrastructure (HNSW + cache) — **PLANNED**`.
- The Sprints 26–57 detailed planning section that the prior session attempted to add was reverted.

### 3.4 Contradictions / stale items identified

1. **STALE:** `ROADMAP_REMAINING_SPRINTS.md` reports older state for Sprint 10 (PENDING) and Sprint 11 (Phase 2B + Phase 4 NOT STARTED). Authoritative state per `SPRINT_INDEX.md` is Sprint 10 PASS and Sprint 11 PASS.
2. **STALE:** Top header of `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md` reports Sprint 11 as "UNBLOCKED / READY TO START" while the rest of the same file reports Sprint 11 PASS.
3. **STALE:** Same file reports "Completed: 10 (Sprints 1–10)" / "Current sprint: Sprint 11" in one section and "Completed: 15 ... Current sprint: Sprint 16" in another.

---

## 4. Tests / typecheck / build (Phase 4)

### 4.1 Orchestrator (`apps/legal-orchestrator`)

```
npm run typecheck
> @ordinoxai/legal-orchestrator@0.1.0 typecheck
> tsc --noEmit
(exit 0)
```

```
npm run build
> @ordinoxai/legal-orchestrator@0.1.0 build
> tsc
(exit 0)
```

```
npm test  (vitest run)
 Test Files  73 passed (73)
      Tests  912 passed (912)
   Duration  18.67s
(exit 0)
```

- **Typecheck:** PASS.
- **Build:** PASS.
- **Vitest:** PASS — 73 files / 912 tests, 0 failures.

### 4.2 Root scripts

`package.json` at repo root defines `npm test = jest`, `npm run typecheck = npm run typecheck -w @iterlaw/web`, `npm run lint = npm run lint -w @iterlaw/web`. These target the **web** workspace, not the orchestrator. Not executed in this audit to avoid mutating `node_modules`. **NOT VERIFIED** (deferred — would require a separate run; orchestrator is the authoritative answer-path test surface for Sprint 11+).

---

## 5. Legal safety invariant status (Phase 4 — safety greps)

Greps run against `apps/` (Grep tool, ripgrep-backed):

| Pattern | Hits | Verdict |
|---|---|---|
| `citation_required` | 22 occurrences across 9 files in `apps/` | **active and enforced** in `apps/legal-orchestrator` source + tests |
| `zero_citation_answer_blocked` | 7 occurrences across 5 files in `apps/` | **active and enforced** in `apps/legal-orchestrator` source + tests |
| `legal_review_queue` | 13 occurrences across 5 files in repo (`backend/supabase/migrations/012_phase1_controlled_answer_engine.sql`, `backend/src/services/controlledAskService.ts`, `backend/scripts/phase1-e2e.ts`, `apps/web/lib/supabase/migrations/012-phase1-controlled-answer-engine.sql`, `reports/CURSOR_DEEP_AUDIT_ITERLAW_FULL_PROJECT_REPORT.md`) | **present in legacy/backend path**, not in `apps/legal-orchestrator`. Worth noting (see §5.2) |
| `disable citation_required` / `disable zero_citation_answer_blocked` | 0 | clean |
| `RightsNow` (in `apps/`) | 1 (in `db/migrations/001_legal_rag_foundation.sql:4` as a legacy-name comment) | allowed per CANONICAL_NAMES policy |

### 5.1 External LLM exposure — confirmed pre-existing

The Sprint 11 transport policy in `apps/legal-orchestrator/src/legal/llm/localTransportPolicy.ts` lists `api.openai.com`, `api.anthropic.com`, `generativelanguage.googleapis.com`, `api.cohere.ai`, `api.mistral.ai` as **denied hostnames**. Tests in `apps/legal-orchestrator/src/tests/sprint11*` assert that the orchestrator transport refuses these hosts.

**However**, outside the orchestrator:

- `apps/web/lib/ai/claude.ts:37` performs `axios.post('https://api.anthropic.com/v1/messages', ...)` with header `'x-api-key': process.env.ANTHROPIC_API_KEY`.
- `apps/web/lib/ai/orchestrate.ts:36` calls `askClaudeSonnet(...)` for `IN_SCOPE_COMPLEX` questions; line 33 calls `askGeminiFlash(...)` for `IN_SCOPE_SIMPLE` questions.

This is a **web-side AI fallback path** that bypasses the orchestrator's transport policy.

**Status:** **PRE-EXISTING; NOT INTRODUCED BY THIS SESSION.** It directly conflicts with the documented invariant "External LLM in live answer path: **FORBIDDEN**" (see `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md`). The conflict is documented here for awareness and should be reconciled by a dedicated audit/cleanup sprint (see §9 / §10).

### 5.2 `legal_review_queue` location

`legal_review_queue` is referenced in `backend/` and `apps/web/lib/supabase/migrations/` (Supabase-based path), not in `apps/legal-orchestrator/`. This is consistent with two coexisting answer surfaces: the older Supabase/web answer path (which carries the `legal_review_queue` table) and the newer orchestrator path (which uses different gating). **NOT VERIFIED** whether both paths are active at runtime; reconciliation belongs to a dedicated audit sprint.

### 5.3 Citation gates summary

- `citation_required` invariant: **preserved** in orchestrator code and tests.
- `zero_citation_answer_blocked` invariant: **preserved** in orchestrator code and tests.
- No grep hit for "disable" of either flag anywhere in `apps/`.

---

## 6. Naming consistency status

- `RightsNow` in `apps/`: **1 hit**, in `apps/legal-orchestrator/db/migrations/001_legal_rag_foundation.sql:4` as the comment `-- IterLaw legal RAG foundation. (legacy name: RightsNow)`. This is allowed under `docs/iterlaw/project/00-index/CANONICAL_NAMES.md` (legacy reference, not active material). **VERIFIED clean for active material.**
- `OrdinoxAI` in `apps/`: **8 hits** across `db/README.md`, `db/migrations/001_legal_rag_foundation.sql`, `scripts/seed-legal-rag.ts`, `package.json` (the orchestrator package name is `@ordinoxai/legal-orchestrator`), `README.md`, `src/modules/README.md`, `apps/synthesis-worker/package.json`, `src/ingestion/fetchSource.ts`. These are pre-existing references. `OrdinoxAI` is documented as "wider platform / company brain" in the canonical status file; the operator instruction "Do not use OrdinoxAI" applies to new content this session is authoring — and no new content is being written.

---

## 7. Untracked files

| File | Action |
|---|---|
| `reports/CURSOR_AUDIT_CLAUDE_SPRINT_11_12_QA_REPORT.md` | **untouched** per operator instruction |
| (this report, after write) `reports/ITERLAW_RECOVERY_AUDIT_AND_NEXT_SPRINT_READINESS.md` | new untracked — not committed by this phase |

No other untracked files.

---

## 8. Risks

1. **Doc-truth drift** (medium): `ROADMAP_REMAINING_SPRINTS.md` and the top header of `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md` are stale relative to `SPRINT_INDEX.md`. A future agent reading those documents first will get a wrong picture of where the project is.
2. **External LLM exposure in `apps/web`** (high): `apps/web/lib/ai/claude.ts` + `gemini.ts` + `orchestrate.ts` form an active external-LLM path that contradicts the documented invariant. If this path is reachable from the web UI at runtime, the "no external LLM in answer path" invariant is **not** actually upheld on the web surface — only on the orchestrator surface.
3. **Dual answer surfaces** (medium): the `backend/` Supabase path and the `apps/legal-orchestrator/` path appear to coexist. Their relationship is not summarised in the current status docs.
4. **Reverted-but-visible commits** (low): the two prior-session commits (`4364c3b`, `3605762`) are still visible in `git log` because revert was used rather than force-push. If the operator wants them removed from history entirely, an explicit force-push of a fresh history is required (not done; needs explicit authorisation).

---

## 9. Recommended next sprint

**Recommendation: Option C — Sprint Index Reconciliation (with §5.1 audit appended).**

### Reason

The operator's three options were:

- **Option A — Sprint 13/14/15 continuation.** Rejected. `SPRINT_INDEX.md`, `PROJECT.md`, and `docs/iterlaw/ITERLAW_PROJECT_STATUS.md` agree that Sprints 13–15 have shipped "PASS-for-foundation-only" outcomes. No clear partial-completion is documented as needing continuation. The "live backup not authorised" and "Intelligence Layer disabled by default" outcomes are intentional gates, not pending sprint work.
- **Option B — Sprint 26 planning-only reintroduction.** Rejected as the **immediate** next step. The earlier sprint **docs are not all clean and complete** — `ROADMAP_REMAINING_SPRINTS.md` is stale, the canonical status file is internally contradictory, and `apps/web` carries an external-LLM path that violates a documented invariant. Reintroducing Sprint 26 planning **before** these are resolved risks compounding doc drift and shipping speed-first retrieval on top of an unreconciled foundation.
- **Option C — Sprint index reconciliation.** Accepted. The contradictions in §3.4 plus the external-LLM-path conflict in §5.1 are exactly the kind of thing a reconciliation sprint exists to fix.

### 9.1 Proposed sprint name

**Sprint 12B — Sprint truth reconciliation + answer-path consistency audit.**

(Named 12B to follow the existing "12A" audit-reconciliation precedent. Does not advance the active sprint counter; it is a corrective sprint that runs ahead of Sprint 16.)

---

## 10. Exact proposed next sprint task list (Sprint 12B)

Status of every task below: **NOT STARTED.** No code or doc has been changed by this report.

### 10.1 Task list

| # | Task | Files to touch | Acceptance gate |
|---|---|---|---|
| 1 | Reconcile `docs/iterlaw/project/07-sprints/ROADMAP_REMAINING_SPRINTS.md` to reflect Sprints 10, 11, 12, 13, 14, 15 status as currently documented in `SPRINT_INDEX.md`. Mark Sprints 16–17 as PLANNED. Preserve all post-Sprint-45 backlog text. | `ROADMAP_REMAINING_SPRINTS.md` only | doc-only; pre-existing tests unchanged; orchestrator vitest still 73 files / 912 tests PASS |
| 2 | Fix internal contradiction in `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md`: align the "Current verified gate state" header section with the body "Sprint count" section (Sprint 11 PASS, Sprint 10 PASS, current sprint 16, completed 15). | `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md` only | doc-only; no new files; no SPRINT_INDEX change |
| 3 | Write a **read-only audit memo** at `reports/ITERLAW_WEB_AI_FALLBACK_PATH_AUDIT.md` documenting the current state of `apps/web/lib/ai/claude.ts`, `gemini.ts`, `orchestrate.ts`, the callers, the feature flags (if any) guarding them, and whether `ANTHROPIC_API_KEY` / Gemini API key are required at runtime. No code change in this task. | `reports/ITERLAW_WEB_AI_FALLBACK_PATH_AUDIT.md` (new) | report exists; cites grep output and file:line references; no `apps/` source touched |
| 4 | Add a sprint plan doc `docs/iterlaw/project/07-sprints/SPRINT_12B_TRUTH_RECONCILIATION_PLAN.md` describing the four tasks of this sprint, with acceptance gates and rollback notes. | new file under `07-sprints/` | doc-only; lists every file changed by tasks 1–4 |
| 5 | Update `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md` to add a one-row entry for `Sprint 12B` with status `IN PROGRESS` (then `PASS` after the QA report below is created). | `SPRINT_INDEX.md` | doc-only |
| 6 | Create QA evidence report `reports/ITERLAW_SPRINT_12B_QA_REPORT.md` with: exact git diffs touched, exact orchestrator vitest output, exact grep outputs proving citation gates still enforced, exact statement of what was not touched. | new file under `reports/` | report contains command outputs, not summaries |

### 10.2 Tests required

- Re-run `apps/legal-orchestrator` `npm run typecheck`, `npm run build`, `npm test` — must remain green (73 files / 912 tests PASS).
- Re-run safety greps for `citation_required`, `zero_citation_answer_blocked`, `disable citation_required`, `disable zero_citation_answer_blocked` — counts must remain non-zero on positives and zero on negatives.

### 10.3 Rollback

Every change is doc-only or report-only. Rollback = `git revert` of the resulting commit. No migrations, no manifests, no runtime change, no production impact.

### 10.4 Evidence required before claiming PASS

- Exact commands and outputs of typecheck / build / vitest.
- Exact grep outputs.
- `git diff --stat` of every file touched.
- `git log --oneline` showing the sprint commit.

---

## 11. What must NOT be touched in Sprint 12B

- `apps/legal-orchestrator/src/**` (no orchestrator code change).
- `apps/web/lib/ai/**` (no web AI code change in this corrective sprint — only documented).
- `db/migrations/**` (no migration change).
- `deployment/**`, `k8s/**` (no deployment file change).
- `scripts/operator/**` (no operator script change).
- `reports/CURSOR_AUDIT_CLAUDE_SPRINT_11_12_QA_REPORT.md` (pre-existing untracked file — leave alone).
- The two reverted commits (`4364c3b`, `3605762`) — **do not** attempt to re-apply or to rewrite history (no force-push).
- Anything outside `C:\Users\kalsh\projects\iterlaw`. No F:/rahma. No Sakina. No other project.

---

## 12. PASS / PARTIAL / FAIL verdict

**STATUS: PARTIAL.**

- Repo is clean and consistent at the SPRINT_INDEX level.
- Tests are green.
- Citation gates are preserved.
- Two pre-existing inconsistencies (stale roadmap doc + external-LLM web path) are flagged and proposed for reconciliation in Sprint 12B.

---

## 13. Final truth statement

- No commit was created by this report.
- No push was performed.
- No deploy was performed.
- No `kubectl` was invoked.
- No production-deployment file was edited.
- No legal-safety gate was disabled.
- No new architecture document was created beyond this audit report.
- No file outside `C:\Users\kalsh\projects\iterlaw` was modified or committed.
- `F:/rahma` was not touched.
- Sakina was not touched.
- The IterLaw working tree at the time of writing is clean except the single pre-existing untracked file `reports/CURSOR_AUDIT_CLAUDE_SPRINT_11_12_QA_REPORT.md` (left as instructed).
- This report (`reports/ITERLAW_RECOVERY_AUDIT_AND_NEXT_SPRINT_READINESS.md`) is the only new file added by this phase; it is **uncommitted** and **not pushed**.

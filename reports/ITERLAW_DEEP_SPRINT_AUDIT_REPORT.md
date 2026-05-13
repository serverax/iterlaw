# IterLaw Deep Sprint Audit Report

**Auditor role:** Independent Sprint Audit AIA (read-only verification).  
**Audit date:** 14 May 2026 (local workspace).  
**Reviewed migration fix commit:** `c17ffc2` — `fix(iterlaw): make legal cases migration compatible with legacy schema`  
**Audit artefact commit:** `6b2bc8a` — `test(iterlaw): add deep sprint audit report`  
**Branch:** `master` — **ahead 17** of `origin/master` after this commit, **behind 0**.

## Status

**PARTIAL** — Legal-orchestrator **typecheck, build, and full Vitest pass** on this host; **no dev/staging AKS replay evidence** was produced in this audit session; **Sprint 10 cannot be marked PASS** under the stated rule. One **documentation truth** defect: sprint index cites **stale test counts** vs current runner output.

---

## Executive summary

| Item | Value |
|------|--------|
| Repo root | `C:/Users/kalsh/projects/iterlaw` |
| Branch / drift | `master` … `origin/master` **[ahead 17, behind 0]** (after audit commit) |
| HEAD | `c17ffc2` (migration 102 compatibility shim; follows `21364f4` on 100-shim) |
| Sprint truth (high level) | **1–9:** evidence supports **PASS** (commits + tests + canonical docs). **10:** **PARTIAL** (code + local Docker evidence in repo reports; **real staging DB verification PENDING**). **11:** **BLOCKED** at org/gate for completion/live transport; **PARTIAL** on mock-safe code already merged. **12–45:** **PLANNED** / roadmap. **46–57:** **post-45 backlog**. |
| Main blocker | **Operator-recorded dev/staging DB verification** for Sprint 10 (checklist + sign-off artefact). |
| Next action | Operator executes `SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md` on **confirmed non-prod** Postgres; capture `reports/ITERLAW_SPRINT_10_STAGING_APPLY_<date>.log` (or equivalent); then reconcile sprint index test counts. |

---

## Sprint status table (1–45)

Legend: **PASS** | **PARTIAL** | **BLOCKED** | **PLANNED** | **UNKNOWN**

| Sprint(s) | Title (short) | Status | Evidence / notes |
|-----------|---------------|--------|-------------------|
| 1–8 | Foundation | **PASS** | `SPRINT_INDEX.md` + historical commits; orchestrator tests green. |
| 9 | Rename + schema alignment | **PASS** | `@iterlaw/*`, LF policy, migration 102 introduced; tests. |
| 10 | Live RAG + DB + workspace/RLS | **PARTIAL** | Code + `migration102CompatibilityShim` + `c17ffc2`; `ITERLAW_PROJECT_STATUS.md` + `SPRINT_INDEX.md` state **staging DB verification PENDING**; `reports/ITERLAW_SPRINT_10_LOCAL_DOCKER_DB_VERIFY.md` supports **local Docker** only — **not** substitute for operator staging evidence per audit rule. |
| 11 | Local LLM gateway + transport | **BLOCKED** (gate) / **PARTIAL** (code) | Canonical status: **BLOCKED** until Sprint 10 staging closeout. Code: gateway, transport deny policy, tests; **`runLocalDraftingStep` not referenced from `handleLegalRequest.ts`** (grep: no matches) — matches sprint index “pipeline wiring NOT STARTED”. |
| 12 | Backup go-live | **PLANNED** | `SPRINT_INDEX.md` row. |
| 13 | MVP polish | **PLANNED** | |
| 14 | Member/auth/subscription | **PLANNED** | |
| 15 | Admin / legal-review UI | **PLANNED** | |
| 16 | Live evolution | **PLANNED** | |
| 17 | UK GDPR / retention | **PLANNED** | |
| 18–25 | Law Module Engine (roadmap renumber) | **PLANNED** | `ROADMAP_REMAINING_SPRINTS.md`. |
| 26–34 | Speed-first retrieval | **PLANNED** | |
| 35–45 | WASM intelligence stack | **PLANNED** | Roadmap target **Sprint 45**. |

**Sprints 46–57:** **PLANNED (post-45 backlog)** — explicitly excluded from the “36 / 35 remaining” counts in `ROADMAP_REMAINING_SPRINTS.md`.

### False PASS / stale claim findings

1. **`docs/iterlaw/project/07-sprints/SPRINT_INDEX.md`** Sprint 10 row cites **“615 / 51”** tests — **stale**. This audit run: **`708` tests, `55` files** (`npx vitest run` in `apps/legal-orchestrator`, exit 0). Update the index or cite a pinned report with command output.
2. **`docs/iterlaw/project/11-ai-governance/AI_GOVERNANCE_INDEX.md` L68** links `SUPERIOR_AI_ARCHITECT_AIA.md` — file **missing**; actual file is `SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md` — **broken doc link**.
3. **`reports/ITERLAW_QA_REPORT_SPRINT_10_MIGRATION_102_COMPATIBILITY_FIX.md`** — **missing** (user checklist expected a dedicated report; evidence instead lives in **`c17ffc2`** + `migration102CompatibilityShim.test.ts`).

**No doc found in this pass that claims “Sprint 10 complete” or “staging PASS” as fact** — counterexamples in `DOCUMENTATION_TRUTH_PROTOCOL.md` are **anti-patterns**, not claims.

---

## Sprint 10 audit

### Root cause (historical)

Numeric replay that applied **`100_iterlaw_core_rag_foundation.sql`** created `public.legal_cases` with **`judgment_date`** and without **`decision_date`**, **`source_provider`**, **`metadata`**, etc. **`102_add_legal_cases_table.sql`** then hit **`CREATE INDEX … (decision_date)`** failures.

### Fix

- **`c17ffc2`** — additive **`ALTER TABLE … ADD COLUMN IF NOT EXISTS`** block **before** dependent indexes in `102_add_legal_cases_table.sql`.
- **`21364f4`** — compatibility shim inside draft **`100_*.sql`** for replay tools that still execute it.

### Test evidence (this audit)

| Command | Exit | Result |
|---------|------|--------|
| `npx tsc --noEmit` | 0 | PASS |
| `npm run build` | 0 | PASS |
| `npx vitest run src/tests/migration102CompatibilityShim.test.ts` | 0 | **11** tests PASS |
| `npx vitest run` | 0 | **708** tests, **55** files PASS |

### Remaining DB replay requirement

Per `SPRINT_INDEX.md`, `ITERLAW_PROJECT_STATUS.md`, and `SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md`: **operator** applies **`104` / `105` / `106`** on **confirmed dev/staging**, runs SQL + RLS verification, sets `DATABASE_URL`, runs `verify-iterlaw-rag-db.sh`, captures sign-off. **No production.**

### Sprint 10 replay readiness classification

**SPRINT_10_REPLAY_READY_CODE_SIDE**

**Reason:** Typecheck/build/full Vitest + dedicated **`migration102CompatibilityShim`** tests pass; static review shows **102** shim ordering satisfies **100**-legacy column gaps; **104–106** forward files assert non-destructive forward path (`.down.sql` files contain DROP/DELETE — **expected for rollback only**, not forward chain).

**Not claimed:** Sprint 10 **PASS** overall (blocked on operator staging evidence per mission rules).

---

## Sprint 11 audit

| Question | Result |
|----------|--------|
| Blocked until Sprint 10 PASS? | **Yes** for **completion / live HTTP / production**. Canonical files: `SPRINT_INDEX.md` (“Sprint 11: **BLOCKED**”), `ITERLAW_PROJECT_STATUS.md`. |
| External LLM in live path? | **`handleLegalRequest.ts`** remains skeleton re **external LLM** (header comment); **`external_llm_used: false`** enforced in traced paths. |
| Provider SDKs in `package.json`? | **Only** `express`, `zod` (+ dev tooling). **No** OpenAI/Anthropic/Gemini SDK deps. |
| `openai` / `anthropic` / etc. in `src/`? | **Tests**, **transport deny lists**, **gateway types** (`llmGateway.types.ts` includes `"bifrost"` as mode name), **`localOllamaGateway.ts`** (uses `fetch` only when global fetch exists — still **no provider SDK**). |
| Pipeline wiring | **`runLocalDraftingStep`** **not** imported in `handleLegalRequest.ts` — Sprint 11 “live drafting in request path” **not** wired. |

**Conclusion:** Sprint 11 is **correctly BLOCKED** at the **organisational completion** gate; partial **mock-safe** implementation exists and is tested.

---

## Migration audit

### Forward chain files (numeric order)

`000` → `010` → **`100` (draft — verifier / doc: DO NOT APPLY on prod 001-chain)** → `101` → `102` → **[103 reserved]** → `104` → `105` → `106`

### Destructive SQL (forward `.sql`)

- **Forward migrations `000–010`, `101`, `102`, `104–106`:** comments assert **no DROP/TRUNCATE/destructive ALTER** in forward path; **`102`** and **`100`** compatibility blocks are **additive only**.
- **`.down.sql` files** and some **`002`** constraint maintenance: contain **`DROP TABLE`**, **`DROP COLUMN`**, **`DELETE FROM`** — **rollback / dev-down path**; operators must treat **down** separately from **prod forward** apply.
- **`002_legal_rag_sprint6.sql`**: contains **`ALTER TABLE … DROP CONSTRAINT`** (constraint swap) — review if replaying on legacy DBs.

### `legal_cases` compatibility

| Check | Verdict |
|-------|---------|
| 102 compatibility **before** indexes | **PASS** (file order: ALTER block lines 77–110, first index at 115+). |
| `ADD COLUMN IF NOT EXISTS` for index columns | **PASS** (`source_id`, `decision_date`, `source_provider`, `metadata`, etc.). |
| 104/105/106 vs `legal_cases` | **No ALTER** on `public.legal_cases`; **105** explicitly disambiguates user `legal_case_*` vs corpus `legal_cases`. |

### Static replay matrix (abbreviated)

| Migration | Creates (principal) | Adds / alters (principal) | Indexes | Depends on | Risk |
|-----------|---------------------|---------------------------|---------|--------------|------|
| 000 | (extension) pgvector | — | — | Postgres | Low |
| 001 | `legal_domains`, `legal_sources`, `legal_documents`, `legal_chunks`, + audit/ingestion tables | various | many | 000 | Medium if mixed with 100 |
| 002–010 | Sprint6–10 UK schema, QA cache, rates, superseded_by, seeds | additive columns / `uk_emp_rag.*` | many | 001, prior | Medium on 002 constraint drops |
| 100 | Draft tables + `legal_cases` (draft shape) | compatibility ALTER + indexes | indexes | 001 tables may already exist — **IF NOT EXISTS no-op risk** | **High if applied on 001-chain** (doc: do not apply) |
| 101 | `verified_answers_cache`, `rag_runs`, `source_update_log`, `answer_verification_log` | — | indexes | 001 | Low |
| 102 | `public.legal_cases` (IF NOT EXISTS) | **shim ALTERs** | 7+ indexes | pgcrypto, 001 optional | **Low** after `c17ffc2` |
| 104 | `users`, `workspaces`, `workspace_members` | FK DO blocks | many | pgcrypto | Low |
| 105 | `legal_case_records`, facts, documents, drafts, timeline, sources | FK DO blocks | many | 104 | Low |
| 106 | RLS policies + helper functions | ENABLE ROW LEVEL SECURITY | — | 104, 105 | Low (policy idempotency via DO blocks) |

**Static analysis cannot prove** runtime performance, lock behaviour, or **operator role** correctness — **UNKNOWN** without `psql` replay.

---

## Test audit

**Workspace:** `apps/legal-orchestrator`

| Step | Exit | Result |
|------|------|--------|
| `npx tsc --noEmit` | 0 | PASS |
| `npm run build` | 0 | PASS |
| `npx vitest run src/tests/migration102CompatibilityShim.test.ts` | 0 | 11/11 |
| `npx vitest run` | 0 | **708** tests, **55** files |

---

## AIA automation audit

| Path | Status |
|------|--------|
| `.aia/` | **Missing** (glob 0 files) |
| `apps/ordinox-aia-orchestrator/` | **Missing** |
| `reports/aia-handoffs/` | **Missing** |
| `docs/iterlaw/project/11-ai-governance/SPECIALIST_AIA_SPRINT_OWNERSHIP_PLAN.md` | **Missing** |
| `docs/iterlaw/project/11-ai-governance/ORDINOXAI_AIA_AUTOMATION_FOUNDATION.md` | **Missing** |

**Governance docs present:** `AIA_OPERATING_MODEL.md`, `AI_GOVERNANCE_INDEX.md`, `SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md`, `DOCUMENTATION_TRUTH_PROTOCOL.md`, etc.

**Runner commands:** **NOT EXECUTED** (no app directory).

---

## Naming audit

| Pattern | Finding |
|---------|---------|
| `RightsNow` / `rightsnow` in active code | **Verifier / policy / sprint changelog** references expected; **apps/** product code: no hits in prior QA patterns — treat as **safe / forbidden-policy text**. |
| `iterlaw-prod` | **`k8s/synthesis-worker/*`** mentions as **legacy ADR reference** — **historical / warning**, not an active namespace manifest requirement. |
| `localOllamaGateway.ts` default URL | Uses **`ollama.ordinox-ai.svc.cluster.local`** — **OrdinoxAI platform** namespace string; differs from **`iterlaw-ai`** canonical table in `CANONICAL_NAMES.md` — classify as **platform vs product namespace split** (document/clarify; not necessarily a security defect). |
| Package `name` | **`@ordinoxai/legal-orchestrator`** — `CANONICAL_NAMES.md` L9 says IterLaw used in “package names” — **minor doc/product naming tension** (package scope is company brain). |

---

## Safety / secret audit

**Method:** Path-scoped searches; **no secret values printed.**

| Class | Example locations | Classification |
|-------|-------------------|----------------|
| `DATABASE_URL` | `k8s/iterlaw/secrets/sealedsecret-template.yaml` comments | **safe placeholder / doc** |
| `kubectl apply` | `OPERATIONS_RULES.md`, `QA_PROCESS.md`, `INFRA_SUMMARY.md` | **safe policy** (“operator only”, “no agent apply”) |
| `PRIVATE KEY` / `API_KEY` | migration tests (`not.toMatch(/BEGIN PRIVATE KEY/)`) | **test fixture** |
| `psql` / production | operator checklists | **safe procedure** + production refusal guards |

**No `BEGIN RSA PRIVATE KEY` / live DSN literals** surfaced in this audit’s limited search.

---

## Architecture consistency audit

| Topic | Consistent? | Notes |
|-------|---------------|-------|
| Tier model (0–5, LLM = Tier 5) | **Mostly YES** | `MULTI_TIER_RETRIEVAL_ARCHITECTURE.md` L5–7 states **current code is single-tier retrieval + disabled synthesis** — honest vs `ITERLAW_PROJECT_STATUS.md` “Tier 0–4 not implemented”. |
| Offline-first / local DB first | **YES** | `ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md` + status doc. |
| External LLM forbidden | **YES** | ADR + status + tests. |
| Sprint 10 pending | **YES** | Status + roadmap + sprint index. |
| Sprint 11 blocked / partial | **Mixed terminology** | Index header “BLOCKED” vs table row “PARTIAL” — **clarify language** (gate vs implementation). |

**Contradictions / gaps**

1. **`AI_GOVERNANCE_INDEX.md`** wrong filename for Superior AIA spec (see above).
2. **`CANONICAL_NAMES.md`** vs **`@ordinoxai/legal-orchestrator`** scope wording.
3. **Sprint index** stale Vitest counts.

---

## Required next actions (prioritised)

1. **Operator:** Run **`SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md`** on **confirmed non-production** Postgres (migrations **104–106**, RLS tests, `verify-iterlaw-rag-db.sh` with `DATABASE_URL`).
2. **Capture evidence:** `reports/ITERLAW_SPRINT_10_STAGING_APPLY_<YYYY-MM-DD>.log` (or checklist §12 block).
3. **Docs:** Update **`SPRINT_INDEX.md`** Vitest counts to **708 / 55** (or “see CI / dated report”) after evidence refresh.
4. **Fix link:** `AI_GOVERNANCE_INDEX.md` → `SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md`.
5. **Optional:** Add **`reports/ITERLAW_QA_REPORT_SPRINT_10_MIGRATION_102_COMPATIBILITY_FIX.md`** summarising **`c17ffc2`** + test commands (truth artefact).
6. **Sprint 11:** Keep **BLOCKED** for completion until Sprint 10 staging **PASS** recorded; continue mock-safe work only if policy allows.
7. **Production:** Remain **BLOCKED**.
8. **Push:** Only after **operator authorisation** (not done here).

---

## Truth statement

- **No push** performed.
- **No deployment** performed.
- **No kubectl mutating command** performed.
- **No production DB** touched.
- **No external LLM** call performed.
- **No secret values** printed in this report.

---

## Inventory — requested docs

| File | Status |
|------|--------|
| `ITERLAW_PROJECT_STATUS.md` (root) | **Exists** — pointer to canonical doc. |
| `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md` | **Exists** |
| `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md` | **Exists** |
| `docs/iterlaw/project/07-sprints/ROADMAP_REMAINING_SPRINTS.md` | **Exists** |
| `docs/iterlaw/project/07-sprints/SPRINT_10_STAGING_DB_OPERATOR_RUNBOOK.md` | **Exists** |
| `docs/iterlaw/project/09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md` | **Exists** |
| `docs/iterlaw/project/01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md` | **Exists** |
| `docs/iterlaw/project/10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md` | **Exists** |
| `docs/iterlaw/project/11-ai-governance/AI_GOVERNANCE_INDEX.md` | **Exists** |
| `docs/iterlaw/project/11-ai-governance/SPECIALIST_AIA_SPRINT_OWNERSHIP_PLAN.md` | **MISSING** |
| `docs/iterlaw/project/11-ai-governance/ORDINOXAI_AIA_AUTOMATION_FOUNDATION.md` | **MISSING** |
| `reports/ITERLAW_QA_REPORT_SPRINT_10_MIGRATION_102_COMPATIBILITY_FIX.md` | **MISSING** |
| `reports/ITERLAW_OFFLINE_FIRST_DB_ARCHITECTURE_UPDATE_REPORT.md` | **Exists** |

# Cursor Independent QA Audit — Claude Sprint 11 and Sprint 12 Work

**Auditor:** Independent QA (read-only; no fixes applied in this task).  
**Repo:** `C:/Users/kalsh/projects/iterlaw`  
**Audit run:** 2026-05-13 (local).  
**HEAD at audit:** `00f03f9` — `docs(iterlaw): record sprint 11 phase 2b and phase 4 QA`  
**Branch:** `master` — **ahead 3** of `origin/master` (`7bd2023`), **behind 0**; working tree includes **this report** as untracked until committed.

---

## 1. Executive verdict

| Area | Verdict | Why |
|------|---------|-----|
| Sprint 11 Phase 2B local LLM transport | **PASS** | `HttpOllamaTransport`: policy gate before I/O; hard timeout; non-2xx without body read; malformed JSON handled; injected `fetchImpl` only; no DSN literals in transport source; **20** dedicated tests PASS (this run). |
| Sprint 11 Phase 4 pipeline wiring | **PASS** | `handleLegalRequest` calls `runLocalDraftingStep` only when `deps?.transport` **and** `chunks.length > 0`; mock transport call-count tests; hallucinated chunk id → `citation_failed`; **10** dedicated tests PASS (this run). |
| Sprint 11 overall | **PARTIAL** | **Code + tests:** PASS for Phases 2B+4. **Project truth:** `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md` is **internally contradictory** (gate bullets vs sprint-count bullets vs table row — see §5). **Source comments** in `handleLegalRequest.ts` and `runLocalDraftingStep.ts` still claim pipeline/drafter not wired — **stale** vs code. |
| Sprint 12 backup script | **PASS (dry-run)** | `scripts/backup/iterlaw-db-backup.sh` — `set -euo pipefail`; default `--dry-run`; refuses production-like host/label in live mode; does **not** echo DSN; writes timestamped manifest. **Evidence:** dry-run exit **0** (PowerShell `bash` → produced manifest under `./tmp/cursor-sprint12-audit/`). |
| Sprint 12 restore verification | **PASS (dry-run, Git Bash)** | `scripts/backup/iterlaw-db-restore-verify.sh` — delegates to `verify-backup-manifest.mjs`; dry-run default; production / same-target refusal paths in live mode. **FAIL** when invoked from **WSL `bash`** without `node` on PATH (validator subprocess); **PASS** under **Git Bash** with Node — see §6. |
| Sprint 12 manifest verifier | **PASS** | `verify-backup-manifest.mjs` + `manifestValidator.mjs` — exited **0**, stdout `manifest OK` on generated manifest. |
| Sprint 12 tests | **PARTIAL / FAIL on this host** | `apps/legal-orchestrator/src/tests/sprint12BackupScripts.test.ts` — **35** passed, **4** failed: `execFileSync("bash", …)` cannot spawn `bash` on default Windows PATH used by Vitest (ENOENT). **Not** a logic failure of manifest tests. |
| Sprint 12 docs (`12-backup-go-live/`) | **NOT PRESENT** | ADR/runbook/QA paths under `docs/iterlaw/project/12-backup-go-live/` still **missing**; infra backup docs live under `docs/infra/` + `k8s/iterlaw-data/backups/`. |
| Sprint 12 overall | **PASS FOR DRY-RUN FOUNDATION ONLY** | Scripts + validators + manifest contract are **implemented and reviewed**; **no** live `pg_dump` / restore drill in this audit; **no** `12-backup-go-live` doc pack; Vitest bash-spawn **fragile on Windows**. |
| Secret safety | **PASS** | No secret **values** printed here; `legal/llm` transport avoids env DSN reads; tests assert no `DATABASE_URL`/`POSTGRES_PASSWORD` leakage in transport source and response envelopes. |
| External LLM safety | **PASS** | No provider SDK in `apps/legal-orchestrator/package.json`; `rg` hits in `src` are **deny-list**, **comments**, **tests**, or **`localOllamaGateway`** (separate legacy path — still not OpenAI SDK). |
| Naming consistency | **PARTIAL** | `RightsNow` / `iterlaw-prod` hits are **policy / verifier / canonical-names** text — **safe**. **Issue:** `SPRINT_INDEX.md` narrative inconsistency (not a forbidden name, but **governance truth** defect). |
| Production safety | **PASS** | Docs and QA artefacts state **production BLOCKED**; no production-ready claim accepted for this audit; read-only `kubectl` only (see §7). |

---

## 2. Repo state

| Item | Value |
|------|--------|
| Repo root | `C:/Users/kalsh/projects/iterlaw` |
| Branch | `master` |
| HEAD | `00f03f9` |
| `origin/master` | `7bd2023` (local **ahead 3**: `3681fab`, `120b9de`, `00f03f9`) |
| Working tree | **Clean** at audit start (only this report added afterward if committed separately) |

**Latest 20 commits (decorate):** see shell log — includes `00f03f9`, `120b9de`, `3681fab`, `7bd2023`, `449642d`, `c102f51`, …

---

## 3. Commits audited

| Commit | Sprint / phase | Type | Verdict | Notes |
|--------|------------------|------|---------|-------|
| `7bd2023` | Sprint 11 closeout | docs | **PASS** | Adds ADR `ADR_SPRINT_11_LOCAL_LLM_TRANSPORT_AND_PIPELINE_WIRING.md` + `SPRINT_11_CLOSEOUT_IMPLEMENTATION_PLAN.md`; touches status pointers. |
| `3681fab` | Sprint 11 Phase 2B | impl + tests | **PASS** | `httpOllamaTransport.ts`, `llm/index.ts`, `sprint11Phase2bHttpTransport.test.ts` (+706 lines). |
| `120b9de` | Sprint 11 Phase 4 | impl + tests | **PASS** | `handleLegalRequest.ts`, `legal.ts`, `sprint11Phase4PipelineWiring.test.ts` (+482/−7). |
| `00f03f9` | Sprint 11 QA record | docs | **PARTIAL** | Adds `SPRINT_11_PHASE_2B_4_QA_REPORT.md` and status updates; **does not reconcile** contradictory `SPRINT_INDEX.md` sections (see §5). |
| `c102f51` | Sprint 11 hardening | tests | **PASS** | `sprint11RagGatewayHardening.test.ts` (+561). |
| `449642d` | Sprint 11 gateway QA | docs | **PASS** | `reports/ITERLAW_SPRINT_11_LOCAL_LLM_RAG_GATEWAY_QA_2026-05-13.md` + status pointers. |

**Commits after `00f03f9`:** **none** on `master` (HEAD is latest). **No** Claude “Sprint 12 backup” commits after `00f03f9` in this branch tip.

**`git log --oneline --decorate --all --since="2026-05-10"`:** long list including older Sprint 10/11 and unrelated historical “Sprint 12 UI” web commits — **not** the requested `scripts/backup/*` Sprint 12 deliverables.

---

## 4. Files audited (representative)

| File | Purpose | Verdict | Notes |
|------|---------|---------|-------|
| `apps/legal-orchestrator/src/legal/llm/httpOllamaTransport.ts` | Fail-closed Ollama HTTP adapter | **PASS** | Policy before fetch; timeout; no literal `fetch(`; no error text leakage. |
| `apps/legal-orchestrator/src/pipeline/handleLegalRequest.ts` | Phase 4 wiring | **PARTIAL** | Logic **PASS**; **file header comment** still says “no Ollama” / skeleton — **false vs implementation**. |
| `apps/legal-orchestrator/src/legal/llm/runLocalDraftingStep.ts` | Drafter | **PARTIAL** | Safety contract **PASS**; **header** still says pipeline does not call helper — **false** after Phase 4. |
| `apps/legal-orchestrator/src/legal/llm/index.ts` | Barrel export | **PASS** | Re-exports transport. |
| `apps/legal-orchestrator/src/types/legal.ts` | Response unions | **PASS** | Adds `llm_unavailable`, `direct_local`. |
| `apps/legal-orchestrator/src/tests/sprint11Phase2bHttpTransport.test.ts` | Phase 2B tests | **PASS** | 20 tests, mock `fetchImpl` only. |
| `apps/legal-orchestrator/src/tests/sprint11Phase4PipelineWiring.test.ts` | Phase 4 tests | **PASS** | 10 tests, mock transport + retrieval. |
| `docs/.../ADR_SPRINT_11_LOCAL_LLM_TRANSPORT_AND_PIPELINE_WIRING.md` | ADR | **PASS** | Exists. |
| `docs/.../SPRINT_11_CLOSEOUT_IMPLEMENTATION_PLAN.md` | Plan | **PASS** | Exists. |
| `docs/.../SPRINT_11_PHASE_2B_4_QA_REPORT.md` | Claude QA narrative | **PARTIAL** | Strong Phase 2B/4 evidence; asserts **Sprint 11 PASS** — **conditionally accepted** (see §5); `SPRINT_12 READY` is **planning-only** (scripts exist under `scripts/backup/` but `12-backup-go-live` docs absent). |
| `scripts/backup/iterlaw-db-backup.sh` | Operator DB backup | **PASS** (dry-run) | See §6. |
| `scripts/backup/iterlaw-db-restore-verify.sh` | Restore verification | **PASS** (dry-run, Git Bash) | See §6. |
| `scripts/backup/verify-backup-manifest.mjs` | Manifest CLI | **PASS** | |
| `scripts/backup/manifestValidator.mjs` | Shared validation | **PASS** | Imported by tests + verifier. |
| `apps/.../sprint12BackupScripts.test.ts` | Sprint 12 tests | **PARTIAL** | 35 pass / 4 fail on Windows bash spawn. |
| `docs/.../12-backup-go-live/*` | Sprint 12 ADR/runbook/QA | **MISSING** | **0** paths. |
| `PROJECT.md` | Top-level pointer | **YES** | Exists; aligns with canonical status pointers (not re-audited line-by-line). |
| `ITERLAW_PROJECT_STATUS.md` (root) | Pointer | **YES** | Exists. |
| `docs/iterlaw/ITERLAW_PROJECT_STATUS.md` | Status | **YES** | Exists. |
| `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md` | Canonical status | **YES** | Exists; must be reconciled with `SPRINT_INDEX` by owners (not modified here). |
| `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md` | Sprint table | **FAIL (truth)** | **Contradictions:** L10 says Phase 2B+4 **NOT STARTED**; L28–29 say Sprint 11 **PASS** with 2B+4 done; L36 says Sprint 11 **READY TO START**; L58–59 table still **PARTIAL** + “NOT STARTED”. L9 vs L58: Sprint 10 **PASS** vs table **PARTIAL**/stale counts. |

---

## 5. Sprint 11 detailed audit

### Phase 2B (transport)

| # | Question | Result |
|---|----------|--------|
| 1 | Fail closed? | **YES** — policy deny → `unavailable` without socket. |
| 2 | Block external providers? | **YES** — `evaluateLocalTransportPolicy` + tests with `api.openai.com` etc. |
| 3 | Avoid direct external LLM SDK calls? | **YES** — deps are `express` + `zod` only. |
| 4 | Avoid printing prompt bodies? | **YES** — no `console.log` of prompts; errors collapsed. |
| 5 | Avoid leaking DATABASE_URL / DSN? | **YES** in transport module; RAG still uses `DATABASE_URL` elsewhere by design (not in LLM transport). |
| 6 | Timeout safe? | **YES** — `AbortController` + timer. |
| 7 | Non-2xx safe? | **YES** — returns `unavailable`, body not read. |
| 8 | Invalid JSON safe? | **YES** — `malformed` path. |
| 9 | LLM only after RAG chunks? | **YES** — `chunks.length > 0` guard in pipeline. |
| 10 | Block missing citations? | **YES** — via drafter + output guard + tests (`citation_failed`). |
| 11 | Block invalid chunk IDs? | **YES** — test “hallucinated chunk_id”. |
| 12 | `/ready` safe? | **NOT REGRESSED by Phase 2B/4** per QA report cross-ref + existing tests; `server.ts` maps `describe()` to safe payload. |
| 13 | Preserve behaviour without transport? | **YES** — no `deps.transport` → legacy skeleton path. |
| 14 | Tests meaningful? | **YES** — policy, timeout, JSON, envelope scans, call counts (not only trivial mocks). |
| 15 | Status docs truthful? | **PARTIAL** — `SPRINT_11_PHASE_2B_4_QA_REPORT.md` matches **this** test run; **`SPRINT_INDEX.md` is not self-consistent**. |

### `rg` classification (`apps/legal-orchestrator/src` — provider/fetch pattern)

| Classification | Examples |
|----------------|----------|
| Deny-list / policy | `localTransportPolicy.ts` host lists |
| Test fixture / banned string | `sprint11Phase2bHttpTransport.test.ts` URLs; `sprint11RagGatewayHardening.test.ts` |
| Comment / docstring | `httpOllamaTransport.ts`, `llm.types.ts`, `runLocalDraftingStep.ts` |
| Legacy local gateway | `localOllamaGateway.ts` (uses `fetch` via resolver — separate from `HttpOllamaTransport`; still not external provider SDK) |
| **Unsafe external call** | **None found** in production `legal/llm` path beyond intentional **internal** URL when operator configures Ollama. |

### Secret-pattern `rg` (`src` + `docs/.../11-ai-governance`)

| Classification | Examples |
|----------------|----------|
| Safe env var **name** | `DATABASE_URL` in comments, ADR bullet list |
| Redactor / audit | `llmAuditRedactor.ts` token `DATABASE_URL` |
| Tests (sentinel values) | `createAppRetrieval.test.ts`, `sprint11Phase2bHttpTransport.test.ts` |
| RAG wiring | `postgresRetrieval.ts`, `rag.service.ts` read env — **expected** |
| **Unsafe committed secret** | **None verified** (no literal production DSN in source from this audit’s reads). |

### Claude “Sprint 11 PASS” (`SPRINT_11_PHASE_2B_4_QA_REPORT.md` §13)

- **Accepted** for: **Phase 2B + Phase 4 code** and **targeted** Vitest files (`sprint11Phase2b…`, `sprint11Phase4…`) — **PASS** on this host.
- **Caveat:** full `npx vitest run` on this Windows host is **FAIL** (exit **1**) because **`sprint12BackupScripts.test.ts`** cannot spawn `bash` in four integration cases — see §7.
- **Rejected** as: **single source of truth for “all Sprint 11 documentation is consistent”** — blocked on `SPRINT_INDEX.md` contradictions and stale source headers.

---

## 6. Sprint 12 detailed audit

### Tracked deliverables (`git ls-files scripts/backup/`)

| File | Tracked |
|------|---------|
| `iterlaw-db-backup.sh` | yes |
| `iterlaw-db-restore-verify.sh` | yes |
| `verify-backup-manifest.mjs` | yes |
| `manifestValidator.mjs` | yes |
| `restoreTargetValidator.mjs` | yes |

### Script answers (static review + dry-run)

| # | Question | Finding |
|---|----------|---------|
| 1 | `set -euo pipefail`? | **YES** on backup + restore scripts. |
| 2 | Avoid printing `DATABASE_URL`? | **YES** — comments + logic avoid echoing DSN. |
| 3 | Reject missing DB target (live)? | **YES** — live backup requires `ITERLAW_BACKUP_DATABASE_URL`. |
| 4 | Dry-run supported? | **YES** — default `DRY_RUN=1` on backup; restore defaults dry-run. |
| 5 | Manifest created? | **YES** — dry-run writes `*.manifest.json`. |
| 6 | Checksum in manifest? | **dry-run:** `sha256` may be **null** (manifest still validates); live path expects checksum. |
| 7 | Manifest avoids secrets? | **Designed** — validator rejects secret-shaped fields (`manifestValidator.mjs` contract). |
| 8 | Timestamped output? | **YES** — `TIMESTAMP` / `backup_id` in manifest. |
| 9 | Cloud upload default? | **N/A** — no cloud upload in script scope (local paths only). |
| 10 | kubectl default? | **YES** — no kubectl in these scripts. |
| 11 | Mutating DB in dry-run? | **NO** — no `pg_dump` / `pg_restore` executed in dry-run path reviewed. |
| 12 | Isolated restore target? | Live restore requires explicit `ITERLAW_RESTORE_DATABASE_URL` (documented). |
| 13 | Reject same source/target? | **YES** in live restore path (`SOURCE_DSN` vs `TARGET_DSN`). |
| 14 | Reject production target? | **YES** — hostname / label deny patterns. |
| 15 | Verify checksum before restore? | **Live mode** — compares `sha256sum` vs manifest when mode `live` and files exist. |
| 16 | Restore report secrets? | Dry-run report JSON — fields are labels / booleans; DSNs not written by script design. |

### Phase 6 — dry-run evidence (this audit)

| Step | Command / environment | Exit | Result |
|------|------------------------|------|--------|
| Backup dry-run | `bash scripts/backup/iterlaw-db-backup.sh --dry-run --output-dir ./tmp/cursor-sprint12-audit --label cursor-audit` (from repo root) | **0** | Manifest: `tmp/cursor-sprint12-audit/iterlaw-cursor-audit-20260513T052734Z.manifest.json` |
| Manifest verify | `node scripts/backup/verify-backup-manifest.mjs <manifest>` | **0** | `manifest OK` |
| Restore dry-run | Git Bash: `bash scripts/backup/iterlaw-db-restore-verify.sh --dry-run --backup-manifest … --report-out …` | **0** | `restore-report.json` written |
| Restore dry-run | Default `bash` (WSL, no `node`) | **3** | `node` missing — **operator portability risk** |

**Live backup / live restore:** **NOT EXECUTED**.

### Claude Sprint 12 claim

No single doc in `docs/iterlaw/project/12-backup-go-live/` asserts **“Sprint 12 complete”**. **`SPRINT_11_PHASE_2B_4_QA_REPORT.md`** “Sprint 12 READY TO START” remains **planning-only**. **Independent verdict:** **PASS FOR DRY-RUN FOUNDATION ONLY**; **not** a full go-live PASS.

---

## 7. Test evidence

**CWD for all:** `apps/legal-orchestrator`

| Command | Exit | Verdict | Notes |
|---------|------|---------|-------|
| `npx tsc --noEmit` | 0 | **PASS** | |
| `npm run build` | 0 | **PASS** | `tsc` |
| `npx vitest run src/tests/sprint11Phase2bHttpTransport.test.ts` | 0 | **PASS** | 20 tests |
| `npx vitest run src/tests/sprint11Phase4PipelineWiring.test.ts` | 0 | **PASS** | 10 tests |
| `npx vitest run src/tests/sprint12BackupScripts.test.ts` | **1** | **FAIL** | **35** pass, **4** fail — `execFileSync("bash")` ENOENT on this Windows Vitest environment. |
| `npx vitest run` | **1** | **FAIL** | **59** files, **802** tests — **798** pass, **4** fail (same Sprint 12 bash-spawn tests). |

**Workspace root `package.json`:** not used for this audit; orchestrator uses local `npm run typecheck` / `npm test` equivalents as above.

---

## 8. Safety scan evidence (summary)

| Scan | Hit count (approx.) | Unsafe hits | Verdict |
|------|---------------------|-------------|---------|
| `RightsNow\|rightsnow\|iterlaw-prod` (repo sample) | Many in **docs/scripts policy** | **0** in active IterLaw app requirement sense | **PASS** |
| `Azure\|AKS\|Key Vault\|…` (repo-wide count mode) | **>0** in disabled workflows + infra docs | Active runtime claim for IterLaw K3s: **not asserted** by this audit | **PASS** (historical / disabled / doc context) |
| `production verified\|Sprint 12 PASS\|…` (sample) | Matches in **anti-pattern** docs / QA negatives | **0** unsupported “production verified” claims in sample | **PASS** |

---

## 9. Risks and gaps

| Rank | Risk / gap |
|------|------------|
| **Critical** | **`SPRINT_INDEX.md` internal contradictions** on Sprint 10/11 state (summary vs table vs gate bullets). Undermines auditability. |
| **High** | **Stale source headers** (`handleLegalRequest.ts`, `runLocalDraftingStep.ts`) contradict wired behaviour — misleads reviewers. |
| **Medium** | **`localOllamaGateway.ts`** still exists with a different fetch strategy than `HttpOllamaTransport` — two local HTTP stories; needs architectural clarity. |
| **Medium** | **Sprint 12 Vitest + `bash`** — four tests assume `bash` on PATH for `execFileSync`; fails on typical Windows Node environments unless Git Bash / WSL + PATH fixed. |
| **Low** | **`kubectl`**: `iterlaw-rag` namespace exists but **no pods** in this cluster snapshot — empty workload (informational). |

---

## 10. Required fixes (for owners; **not applied** here)

| Priority | Fix | File / area | Reason |
|----------|-----|-------------|--------|
| P0 | Reconcile Sprint 10/11 status into **one** consistent narrative | `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md` | Remove contradictory lines (NOT STARTED vs PASS). |
| P1 | Update module headers to match Phase 4 | `handleLegalRequest.ts`, `runLocalDraftingStep.ts` | Truth in code comments. |
| P2 | Add `docs/iterlaw/project/12-backup-go-live/*` ADR + runbook + QA artefact | docs | Matches Sprint 12 planning checklist. |
| P3 | Harden Sprint 12 tests on Windows | `sprint12BackupScripts.test.ts` | Use `GIT_BASH_PATH` / `process.env.ComSpec` skip / `where bash` probe. |

---

## 11. Final decision

| Question | Answer |
|----------|--------|
| Accept Sprint 11 PASS (full doc programme)? | **NO** — blocked on `SPRINT_INDEX.md` contradictions. |
| Accept Sprint 11 PASS (Phase 2B + Phase 4 **implementation + tests**)? | **YES** |
| Accept Sprint 12 PASS? | **NO** (no live backup/restore drill; doc pack missing; CI red on Windows). |
| Accept Sprint 12 dry-run foundation only? | **YES** — scripts + manual dry-runs + manifest validator behave as designed under Git Bash + Node. |
| Allow Sprint 13 to start? | **PARTIAL** — **NO** if release policy requires green full Vitest on Windows CI; **YES** only for decoupled product work with explicit waiver of bash-spawn tests. |
| Production remains BLOCKED? | **YES** |

---

## 12. Truth statement

- No implementation fixes were made.
- No deployment performed.
- No production DB touched.
- No production restore attempted.
- No destructive DB action performed.
- No kubectl **mutating** command performed.
- No secret values printed.
- No external LLM call performed.
- Sprint 11 Claude PASS accepted: **YES** for **Phase 2B + Phase 4 code/tests**; **NO** for **documentation programme as a whole**.
- Sprint 12 Claude PASS accepted: **NO**
- Sprint 12 dry-run foundation accepted: **YES** (scripts + validator + operator dry-run only).
- Production status: **BLOCKED**.

---

## Phase 7 — K3s read-only

**Executed (read-only):**

- `kubectl get ns` — **OK** (namespaces include `iterlaw-ai`, `iterlaw-rag`, …).
- `kubectl get pods,pvc,svc -n iterlaw-rag` — **OK**, **no resources** in namespace at snapshot time.

**Forbidden commands:** not executed.

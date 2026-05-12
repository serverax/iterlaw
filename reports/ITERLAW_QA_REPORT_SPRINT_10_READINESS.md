# IterLaw QA Report — Sprint 10 Readiness

Last run: 12 May 2026 (Cursor QA bundle, read-only; no push/deploy).

## Sprint position (from `ITERLAW_PROJECT_STATUS.md`)

- **Completed:** Sprints **1–9** (9 marked DONE / QA passed for Sprint 9).
- **Current:** **Sprint 10** — Live RAG DB wiring.
- **Remaining (named):** Sprints **11–15** (5 named + doc estimates **~6** sprints to go-live including buffer).

## Status

**PARTIAL** — Local gate green; repo is **ahead of `origin/master` by 6 commits** after this report commit (not pushed from this session). Sprint 10 **live RAG wiring to production Postgres** remains **not done** per `ITERLAW_PROJECT_STATUS.md`.

## Commands executed

| Command | Result |
|---------|--------|
| `Get-Content .\ITERLAW_PROJECT_STATUS.md` | OK |
| `git status -sb` | before report: `## master...origin/master [ahead 5]`, clean; after commit: **ahead 6** |
| `git diff --stat` / `git diff --cached --stat` | empty (before report add) |
| `git rev-list --count origin/master..HEAD` | **6** (after `cf73176`) |
| `git rev-list --count HEAD..origin/master` | **0** |
| `git log --oneline -5` | see git section |
| `git log --oneline --left-right --graph HEAD...origin/master` | 5 local-only commits shown |
| `git ls-files .env .env.local .env.production .claude iterlaw.code-workspace` | empty |
| `cd apps/legal-orchestrator` + `npx tsc --noEmit` | exit **0** |
| `npm run build` | exit **0** (`tsc`) |
| `npx vitest run` | **44** files, **481** tests, exit **0** |
| `bash ./scripts/infra/verify-iterlaw-repo.sh` (from repo root) | **PASS** |
| `bash ./scripts/infra/verify-iterlaw-canonical-namespaces.sh` | **PASS** (NOT DEPLOYED lines for namespaces expected off-cluster) |
| `bash ./scripts/infra/verify-iterlaw-rag-db.sh` | **PASS** static checks; `NOT EXECUTED psql not on PATH` for live DB |
| `bash -n` on `verify-iterlaw-repo.sh`, `verify-iterlaw-cluster.sh`, `deploy-iterlaw-k3s.sh`, `verify-iterlaw-rag-db.sh`, `verify-iterlaw-canonical-namespaces.sh` | exit **0** |
| `git commit -m "test(iterlaw): add sprint 10 readiness QA report"` | **`cf73176`** (1 file) |

## Commands not executed

- `git push` / deploy / `kubectl apply` / production `psql` / live scrape / external LLM calls (forbidden).
- Push to `origin` (forbidden for this bundle).

## Test results

- **Typecheck:** `npx tsc --noEmit` — **PASS** (exit 0).
- **Build:** `npm run build` — **PASS**.
- **Vitest:** **481** tests, **44** files — **PASS** (exit 0).
- **Failing files:** none.

## Secret scan result

**Real secret found: NO**

Scan method: workspace `rg` (exclude `node_modules`), shape-anchored patterns; **values not printed**.

| Pattern | Match count (approx.) | Classification / notes |
|---------|----------------------|---------------------------|
| `github_pat_` | multiple | **test regex** / **verifier deny-list** (`verify-iterlaw-backup.sh` line 188) |
| `ghp_[A-Za-z0-9]{20,}` | **0** | — |
| `sk-[A-Za-z0-9]{48,}` | **0** | — |
| `sk-(proj|ant|svcacct)-…` (20+ alnum) | **0** | — |
| `AKIA[0-9A-Z]{16}` | **0** | — |
| `AIza[0-9A-Za-z_-]{35}` | **0** | — |
| `BEGIN RSA PRIVATE KEY` | **0** | — |
| `BEGIN OPENSSH PRIVATE KEY` | **0** | — |
| `BEGIN PRIVATE KEY` | multiple | **test regex** (migration / redis manifest tests expect migrations **not** to embed keys) |
| `OPENAI_API_KEY=` | **0** (name appears in docs/verifiers without `=`) | — |
| `ANTHROPIC_API_KEY=` | `.env.example` L13 | **placeholder** (empty RHS) |
| `GEMINI_API_KEY=` | `.env.example` L12 | **placeholder** |
| `SUPABASE_SERVICE_ROLE_KEY=` | `.env.example`, `backend/.env.example` | **placeholder** (`backend` uses `your-service-role-key` text) |
| `DATABASE_URL=` | `k8s/iterlaw/secrets/sealedsecret-template.yaml` (comment) | **placeholder** |
| `POSTGRES_PASSWORD=` | `backupPolicy.test.ts` (negative assertion) | **test regex** |
| `JWT_SECRET=` | **0** | — |
| `STRIPE_SECRET_KEY=` | **0** | — |
| `SENDGRID_API_KEY=` | **0** | — |
| `KUBE_TOKEN` | **0** | — |
| `K3S_TOKEN` | **0** | — |
| `BORG_PASSPHRASE` | docs, CronJobs, scripts, `REPLACE_ME_*` YAML | **env-only reference** / **placeholder** |

**Files to ignore/remove:** none identified as unsafe tracked secrets. Example `.env.example` keys are intentional blanks.

**Safe to commit (content):** YES — no tracked material classified as **real secret** in this pass.  
**Safe to push:** **NOT VERIFIED** from this host (push not run); after push, rely on GitHub secret scanning + branch protection.

## Git hygiene result

- **Clean / dirty:** **clean** working tree (`git diff` empty).
- **Ahead:** **6** | **Behind:** **0** (post-report commit).
- **Untracked / staged:** none at time of check (before adding this report file).
- **Fast-forward push:** No — remote lacks **6** commits; push would **advance `origin/master`** (non-FF from remote’s old view until pushed).
- **Sensitive paths tracked:** none for listed env/workspace paths.

## RAG readiness result

1. **pgvector:** Required by canonical doc + `000_pgvector_prerequisite.sql`; StatefulSet uses **`pgvector/pgvector:pg16`** with inline rationale (`k8s/iterlaw-data/postgres/statefulset.yaml`). Verifier passes static presence checks; **live extension verify** skipped without `psql`.
2. **Canonical DB schema:** **001 chain (`001`–`010`) + `101` + `102`** per `docs/iterlaw/RAG_SCHEMA_CANONICAL_DECISION.md`; **`100_*` is draft / DO NOT APPLY**.
3. **Tables before live retrieval:** `legal_domains`, `legal_sources`, `legal_documents`, `legal_chunks` (+ `uk_emp_rag.*` from 003–010); plus **`101`** tables (`verified_answers_cache`, `rag_runs`, `source_update_log`, `answer_verification_log`); **`102`** `public.legal_cases`.
4. **Runtime vs migrations:** `PostgresRetrieval` queries **`public.legal_chunks`** joined to **`legal_domains`** — matches **001-shaped** canonical columns (`chunk_text`, `search_vector`, etc.).
5. **Temporal filtering:** **Yes** — `effective_date` / `applicable_to` in SELECT + `temporalWhereSql()` with `$6::date` and `RetrievalQuery.filters.applicable_on`.
6. **Uncited answers blocked:** **Partially at orchestrator** — `handleLegalRequest.ts` documents empty RAG → **`insufficient_sources`**; module pipeline / citation verifier path for empty draft → **`citation_failed`** per file header; **full end-to-end** depends on wired retrieval + draft path.
7. **`DATABASE_URL`:** Expected from **env / ctor** in `rag.service.ts`; K8s template stores sealed **`DATABASE_URL`** placeholder — **not** plaintext in git.
8. **Direct external LLM in legal-orchestrator:** **No** per `handleLegalRequest.ts` header (“no DB, no Ollama, no external LLM” skeleton); RAG service selects Postgres or empty mock.
9. **Missing before Sprint 10 DONE:** Wire **`deps.retrieval` / `createRagService`** to **live** Postgres with migrated schema; smoke on **non-prod**; confirm **pgvector** live; rate limits / audit for ingestion (per status doc).
10. **Migrations on non-prod:** **Yes** when operator runs ordered SQL against a **throwaway** DB; follow `db/README.md` + canonical doc; **never** production without change control.

## Backup readiness result

- **`FORCE_RESTORE`:** **Yes** for restore targeting production host fragment — `restore-from-borg.sh` refuses unless `FORCE_RESTORE=true`.
- **Production host guard:** **Yes** — refuses DSN containing `iterlaw-postgres.iterlaw-data.svc.cluster.local` unless override.
- **Secrets:** Templates use **`REPLACE_ME_*`** / SealedSecret placeholders; CronJobs use **`secretKeyRef`** / env-required patterns (`:?`); no committed live passphrases in reviewed YAML.
- **Uploader image:** `upload-cronjob.yaml` still uses **`ghcr.io/serverax/iterlaw-backup-uploader:REPLACE_ME_DIGEST_OR_TAG`** — **placeholder tag** until build/push + digest pin (**blocker** for production promotion).
- **Storage Box CIDR:** `upload-networkpolicy.yaml` documents **placeholder `0.0.0.0/0`** — **must pin /32** before promotion (**blocker** per status + manifest annotations).
- **Safe (review-only):** runbook, restore script shape, verify CronJob wiring, `verify-iterlaw-backup.sh` static checks.
- **Blockers:** unpinned egress CIDR; unpinned uploader image digest; operator must not apply draft manifests until resolved.

## Naming consistency result

- **Total hits (scoped dirs):** low; **apps/** + **packages/** + **k8s/** + **docs/iterlaw/** — **0** legacy product strings. **api/README.md** — **1** (allowed legacy). **scripts/** — `rightsnow` in **deny-list** strings only (`verify-iterlaw-repo.sh`, `verify-iterlaw-namespace-baseline.sh`, `verify-iterlaw-cluster.sh`) — **policy deny-list**, not product naming. **docs/infra/ITERLAW_WORKFLOW_INVENTORY.md** — “retired RightsNow direction” — **historical handoff**.
- **Runtime/config bugs:** **NO**
- **Files that must be fixed:** none in active runtime/config paths.

## CI readiness result

- **Active workflows (7 files):** `ci.yml`, `pull-request.yml`, `ci-reusable.yml`, `legal-orchestrator-ci.yml`, `test.yml`, `build.yml`, `iterlaw-k3s-verify.yml`.
- **Disabled (8 files):** `deploy.yml`, `deploy-staging.yml`, `deploy-production.yml`, `deploy-aks.yml`, `deploy-functions.yml`, `manual-deploy-functions.yml`, `backup.yml`, `legal-orchestrator-image.yml` under `.github/workflows-disabled/`.
- **PR checks:** `pull-request.yml` → **`ci-reusable.yml`** (lint, root `npm run typecheck`, `npm run test:ci` with coverage, Next production build path).
- **Dedicated secret-scan workflow:** **not present** as a standalone workflow; repo scripts (`verify-iterlaw-repo.sh`, `verify-iterlaw-backup.sh`) encode static deny-lists — recommend **GitHub Advanced Security / secret scanning** + required status.
- **Gap before Sprint 10:** **`legal-orchestrator-ci.yml`** is not wired from `ci-reusable.yml` (orchestrator vitest + infra verifiers should be **required** on PR); no **`psql`/migration smoke** against ephemeral Postgres in CI; `.github/DEVOPS.md` still lists deploy/backup workflow names as if under `workflows/` — **doc drift** vs disabled folder.

## Blockers

1. **Push drift:** **6** commits not on `origin/master` — team must **push** (or hold) per release process.  
2. **Live RAG:** Retrieval not verified against **real** migrated Postgres in this run (`psql` absent).  
3. **Backup egress:** Storage Box CIDR still **broad placeholder** until pinned.

## Recommended next sprint tasks

1. Apply migrations to **staging** Postgres; confirm **`vector`** extension and **`legal_chunks.embedding`**.  
2. Deploy orchestrator with **`DATABASE_URL`** from SealedSecret; run **smoke retrieval** queries.  
3. Pin **NetworkPolicy /32** for Storage Box; build and **digest-pin** backup-uploader image.  
4. Add CI job: **vitest** + **`verify-iterlaw-*.sh`** on Linux runner (LF shell).

## Safe to commit?

**YES** — for **this QA report file only**, assuming no other working-tree changes when committing.

## Safe to push?

**NOT VERIFIED** — push not executed; content-wise **no real secrets** found in scan; **6** local commits still need normal PR / review process before `origin/master` update.

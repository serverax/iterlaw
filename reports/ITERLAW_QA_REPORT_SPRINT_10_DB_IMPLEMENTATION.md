# IterLaw QA Report — Sprint 10 DB implementation (legal-orchestrator scope)

**Generated:** 2026-05-12 (Cursor QA pass)  
**Repo:** `C:\Users\kalsh\projects\iterlaw`  
**Scope:** Legal-orchestrator app, DB migrations documentation, legacy Kubernetes bundle archival.

---

## Verdict summary

| Scope | STATUS | Notes |
|--------|--------|--------|
| **legal-orchestrator** | **PASS** | `npm run typecheck`, `npm run build`, `npx vitest run` all exit **0** (51 test files, **615** tests). |
| **Whole repo** | **PARTIAL** | Root `npm run typecheck` exit **0**. Root `npm test` (Jest) exit **1** (60 failed / 39 passed suites in this run — failures outside legal-orchestrator). |

---

## Operator confirmations (this pass)

- **No deploy performed.**
- **No push performed.**
- **No production DB touched** (no `psql` against live DSN; migrations are files + static tests only).
- **No external LLM calls** (no model APIs invoked from this QA session).
- **No secret values** printed in logs or in this report.

---

## What changed (engineering)

1. **Kubernetes — Priority 1**  
   Removed the active duplicate bundle **`k8s/legal-orchestrator/`** (namespace, service, deployment with `:latest`, kustomization).  
   Archived the same manifests under **`k8s/iterlaw-disabled-standalone-legal-orchestrator/`** with a **README** stating: do not apply; canonical workloads live under **`k8s/iterlaw/`**; archived deployment used `:latest` and weaker posture than `k8s/iterlaw/legal-orchestrator/deployment.yaml`.

2. **References**  
   Updated **`k8s/synthesis-worker/README.md`**, **`infra/iterlaw/naming-contract.md`**, and **`.github/workflows-disabled/legal-orchestrator-image.yml`** path triggers to point at **`k8s/iterlaw/`** / the archived tree.

3. **Sprint 10 migration convention — Priority 2**  
   - **`apps/legal-orchestrator/db/migrations`**: convention is **numbered `.sql` files** (and optional **`*.down.sql`**). There are **no `.ts` migration runners** in that directory.  
   - **`102_add_legal_cases_table.sql`**: present; additive `public.legal_cases` (already in chain; unchanged in this pass).  
   - **`103`**: **no `103_*.sql` file** — intentionally **reserved** for future GraphRAG work; documented in **`104_user_workspace_foundation.sql`** header (“Why 103 is skipped”). Sprint 10 **source registry seed** remains in **`004_legal_rag_sprint10_source_registry.sql`** (not a separate 103 file).  
   - **`apps/legal-orchestrator/db/README.md`**: extended with a **forward-chain excerpt** (000–010, 101, 102, reserved 103, 104–106, draft 100 warning).  
   - **`src/tests/migrationChainSprint10Convention.test.ts`**: asserts SQL-only dir, `102` present, no `103_*.sql`, and 104 header mentions 103 reservation.  
   - **`package.json` `validate:migrations`**: includes the new convention test.

4. **Repo verifier**  
   **`bash ./scripts/infra/verify-iterlaw-repo.sh`** → **PASS** (46 active files scanned in this run).

---

## Commands executed (evidence)

```text
# legal-orchestrator
cd apps/legal-orchestrator
npm run typecheck   # exit 0
npm run build       # exit 0
npx vitest run      # exit 0 — 51 files, 615 tests

# repo root
npm run typecheck   # exit 0
npm test            # exit 1 — Jest aggregate failure
bash ./scripts/infra/verify-iterlaw-repo.sh  # PASS
```

---

## Remaining blockers before staging

1. **Whole-repo Jest** — Fix or scope `npm test` so CI reflects intended packages; legal-orchestrator Vitest alone is green.  
2. **Live Postgres** — Apply ordered migration chain on **non-production** only (operator); confirm `vector` extension and smoke retrieval (per `ITERLAW_PROJECT_STATUS.md` / Sprint 10 closeout checklists).  
3. **Canonical image for cluster** — **`k8s/iterlaw/legal-orchestrator/deployment.yaml`** uses **`iterlaw/legal-orchestrator:local`** for dev; production promotion still needs **digest-pinned** registry image and registry secret process (outside this change).  
4. **Archived `:latest`** — Still present **only** under `k8s/iterlaw-disabled-standalone-legal-orchestrator/` for historical reference; must never be applied to a real cluster.

---

## Recommendation

**Claude / Cursor may continue** legal-orchestrator–scoped work. Treat **whole-repo `npm test`** as **FIX_FIRST** before declaring full monorepo green.

---

## Files touched (this session)

- Deleted: `k8s/legal-orchestrator/*.yaml` (4 files)  
- Added: `k8s/iterlaw-disabled-standalone-legal-orchestrator/*` (README + 4 YAML copies)  
- Modified: `apps/legal-orchestrator/db/README.md`, `apps/legal-orchestrator/package.json`, `apps/legal-orchestrator/src/tests/migrationChainSprint10Convention.test.ts` (new), `.github/workflows-disabled/legal-orchestrator-image.yml`, `infra/iterlaw/naming-contract.md`, `k8s/synthesis-worker/README.md`  
- This report: `reports/ITERLAW_QA_REPORT_SPRINT_10_DB_IMPLEMENTATION.md`

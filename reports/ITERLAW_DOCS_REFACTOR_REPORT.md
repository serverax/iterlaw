# IterLaw — Documentation Refactor Report

Documentation-only turn. No source code, migration, test, secret, deploy, or cluster change.

## 1. Files created

New directory: `docs/iterlaw/project/`.

| File | Lines | Purpose |
| --- | --- | --- |
| `README.md` | 65 | Project documentation index — entry point for humans. |
| `00-index/AI_TOOL_START_HERE.md` | 49 | Entry point for Claude Code / Cursor / future AI agents. Read order + locked decisions. |
| `00-index/CANONICAL_NAMES.md` | 57 | Names + namespaces + forbidden tokens (verifier-style policy doc). |
| `01-architecture/ARCHITECTURE_SUMMARY.md` | 54 | Request flow + refusal paths + no-hallucination rule. |
| `02-database/DATABASE_SUMMARY.md` | 70 | Postgres + pgvector + Sprint 10 user-case workspace tables. |
| `03-rag/RAG_SUMMARY.md` | 66 | Trusted UK sources + citation contract + temporal model. |
| `04-ai-llm/LOCAL_LLM_AND_WASM.md` | 85 | Local LLM gateway + WASM deterministic gates. |
| `05-security/RLS_SECURITY_MODEL.md` | 82 | Row-Level Security: GUCs, fail-closed, attack-path test surface. |
| `06-infra/INFRA_SUMMARY.md` | 85 | K3s + ingress + image rules + staging-before-prod. |
| `07-sprints/SPRINT_INDEX.md` | 46 | Current sprint status + DONE criteria. |
| `07-sprints/SPRINT_10_DB_DECISIONS.md` | 51 | Locked Sprint 10 DB decisions. |
| `08-qa/QA_PROCESS.md` | 75 | Evidence-based QA + scoped-vs-whole-repo + truth statement. |
| `09-operations/OPERATIONS_RULES.md` | 68 | Push / deploy / kubectl / secrets standing rules. |

**Total:** 13 files, **853 lines**, mean 65 lines per file, max 85. Every file well under the 150-target / 250-max bound.

## 2. Large files marked legacy / superseded

**None marked.** Every large markdown file in the repo remains authoritative for its long-form content:

- `docs/iterlaw/SUPERIOR_AI_ARCHITECT_AIA.md` (479) — full AIA prompt, no shorter equivalent.
- `docs/iterlaw/ITERLAW_SPECIALIST_AIA_TEAM_PLAN.md` (452) — 10 detailed role descriptions.
- `docs/infra/BACKUP_AND_RESTORE_RUNBOOK.md` (372) — operational runbook.
- `docs/iterlaw/SPRINT_10_LIVE_RAG_PLAN.md` (305) — full plan with all WPs.
- `docs/iterlaw/ORDINOXAI_AIA_COLLABORATION_MODEL.md` (265) — governance.
- `docs/iterlaw/SPRINT_18_MULTIMODAL_EVIDENCE_GROUNDING_BETA_PLAN.md` (262).
- `ITERLAW_PROJECT_STATUS.md` (258).
- `docs/ITERLAW_PROJECT_PLAN.md` (256).

The new small docs are **summaries**, not replacements. The long-form remains the source of detailed truth; the small docs are the AI-friendly entry point.

## 3. Line counts (all new files)

```
   46 docs/iterlaw/project/07-sprints/SPRINT_INDEX.md
   49 docs/iterlaw/project/00-index/AI_TOOL_START_HERE.md
   51 docs/iterlaw/project/07-sprints/SPRINT_10_DB_DECISIONS.md
   54 docs/iterlaw/project/01-architecture/ARCHITECTURE_SUMMARY.md
   57 docs/iterlaw/project/00-index/CANONICAL_NAMES.md
   65 docs/iterlaw/project/README.md
   66 docs/iterlaw/project/03-rag/RAG_SUMMARY.md
   68 docs/iterlaw/project/09-operations/OPERATIONS_RULES.md
   70 docs/iterlaw/project/02-database/DATABASE_SUMMARY.md
   75 docs/iterlaw/project/08-qa/QA_PROCESS.md
   82 docs/iterlaw/project/05-security/RLS_SECURITY_MODEL.md
   85 docs/iterlaw/project/04-ai-llm/LOCAL_LLM_AND_WASM.md
   85 docs/iterlaw/project/06-infra/INFRA_SUMMARY.md
  853 total
```

No file exceeds 90 lines. None exceeds the 250-line cap.

## 4. Naming scan results

### 4.1 `RightsNow / rightsnow` in `docs/iterlaw/project/`

10 hits, all **OK**. Every hit is policy-statement text in `CANONICAL_NAMES.md`, `AI_TOOL_START_HERE.md`, or `INFRA_SUMMARY.md` describing the rule itself ("**Forbidden** in active material", "Never re-introduce", "forbidden alongside the product-name rule"). The verifier-style use of the legacy name to document its prohibition is the allowed pattern.

### 4.2 `iterlaw-prod / namespace: iterlaw` in `docs/iterlaw/project/`

6 hits, all **OK**. Each appears in a forbid-list context (`No iterlaw-prod`, `Do not create or reference`, `Forbidden`, `after iterlaw-prod removal`, `Creating iterlaw-prod or bare iterlaw namespace`). Zero hits of `namespace: iterlaw\b` declaring a bare namespace.

### 4.3 `:latest` in `docs/iterlaw/project/`

8 hits, all **OK**. Breakdown:
- 3 hits in `LOCAL_LLM_AND_WASM.md` are **Ollama model identifiers** (`uk-employment-qwen:latest`), not container images. Documented explicitly in `QA_PROCESS.md`.
- 5 hits in `INFRA_SUMMARY.md`, `QA_PROCESS.md`, `README.md` are rule statements forbidding `:latest` in active manifests.

### 4.4 "production approved" / "deploy production"

**Zero hits.** No false claim of production approval or production deployment.

## 5. Remaining large docs (informational)

Large docs remain in place; the new small docs link to them where relevant. Top remaining files (line counts):

```
479  docs/iterlaw/SUPERIOR_AI_ARCHITECT_AIA.md
452  docs/iterlaw/ITERLAW_SPECIALIST_AIA_TEAM_PLAN.md
372  docs/infra/BACKUP_AND_RESTORE_RUNBOOK.md
305  docs/iterlaw/SPRINT_10_LIVE_RAG_PLAN.md
265  docs/iterlaw/ORDINOXAI_AIA_COLLABORATION_MODEL.md
262  docs/iterlaw/SPRINT_18_MULTIMODAL_EVIDENCE_GROUNDING_BETA_PLAN.md
258  ITERLAW_PROJECT_STATUS.md
256  docs/ITERLAW_PROJECT_PLAN.md
239  docs/adr/004-internal-synthesis-worker.md
234  docs/iterlaw/core-engine-master-build.md
```

These remain authoritative for the detail they carry. AI agents should load them only when the small-doc summary is insufficient.

## 6. Recommended next cleanup

These are **planning notes**, not mandatory next steps.

1. `docs/iterlaw/SUPERIOR_AI_ARCHITECT_AIA.md` and `ITERLAW_SPECIALIST_AIA_TEAM_PLAN.md` could each be split per AIA / per role into a doc-per-role directory if a future sprint needs lighter individual files. Not urgent.
2. `docs/iterlaw/SPRINT_10_LIVE_RAG_PLAN.md` could be split per work-package, but the file is well-organised and reads cleanly at 305 lines.
3. The legacy Supabase migration directories (`migrations/`, `apps/web/lib/supabase/migrations/`, `backend/supabase/migrations/`) should be retired as part of Sprint 13 follow-up — clarity, not data risk.
4. Add a sibling small doc per major sprint when a new sprint lands (`07-sprints/SPRINT_12_DECISIONS.md`, etc.), each ≤ 150 lines.

## 7. Final status: **PASS**

- 13 new small files, total 853 lines (mean 65, max 85).
- Zero files over 250 lines.
- Zero new RightsNow / iterlaw-prod / `:latest` violations.
- Zero production-approval claims.
- Zero source code, migration, test, secret, deploy, or cluster change in this turn.

> No push performed.
> No deployment performed.
> No kubectl mutating command performed.
> No production DB touched.
> No external LLM calls performed.
> No secret values printed.

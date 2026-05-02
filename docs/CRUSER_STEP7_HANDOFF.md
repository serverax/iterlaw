# Cruser: Step 7 Handoff Document

**Branch:** `phase0/step7-qa-pool`  
**Status:** Ready for PR → `master` merge (verify tip commit at merge time with `git rev-parse HEAD`)  
**Date:** May 28, 2026  
**Tests:** 106 passing, 0 failing (30 suites)  
**Build:** Clean; ESLint clean on touched paths  

> **Note:** If your local tip differs from another machine’s `8dabeb1`, treat the **branch + this file** as canonical; always confirm SHA on GitHub before tagging a release.

---

## What Step 7 Shipped

### Core components

| Component | Location | What it does | Status |
|-----------|----------|--------------|--------|
| **Q&A pool (exact cache)** | `lib/qa-pool/content-hash.ts`, `lib/qa-pool/service.ts` | SHA-256 of `jurisdiction \| normalised question` → `qa_pool_entries` lookup / upsert | Working |
| **5-layer orchestrator** | `lib/answer/orchestrator.ts` | Cache → Gov (validated) → Gov+ACAS merge (re-validate) → AI → escalate | Working |
| **ACAS layer** | `lib/gov-apis/acas-guidance.ts` | `queryGovUKAPI('ACAS ' + question)`; prefers ACAS-titled / acas.org.uk rows | Working |
| **Cost tracking** | `lib/answer/cost-log.ts`, `lib/answer/costs.ts` | `logAnswerCostEvent` → `answer_cost_logs` (per layer, optional Supabase) | Working |
| **DOCX generation** | `lib/documents/generate.ts` | `buildAnswerDocxBuffer(UserAnswer)` → RightsNow-branded sections | Working |
| **Database schema** | `lib/supabase/migrations/007-qa-pool.sql` | `qa_pool_entries`, `answer_cost_logs` | Apply in Supabase before relying on pool/costs in prod |
| **Answer API** | `app/api/answer/route.ts` | `POST /api/answer` — Zod body, orchestration, optional DOCX | Working |
| **Cache flag on hits** | `lib/qa-pool/service.ts` | Pool hits attach `cached: true` on the `UserAnswer` | Working |

---

## The 5-layer flow (as implemented)

```
POST /api/answer
  → orchestrateAnswer({ question, jurisdiction, companyName?, situation_type?, employment_dates? })

Layer 1 — Cache (exact content hash)
  → findCachedUserAnswer → hit: return success + source 'cache' + layersTried includes 'cache'

Layer 2 — Gov APIs (parallel orchestration + validation)
  → queryAllGovAPIs → validateAndFormatAnswer on gov rows only
  → If shippable (confidence + validation rules): upsert pool (source gov), return

Layer 3 — ACAS-biased GOV.UK rows merged with gov rows
  → queryAcasGuidance → merged list → validateAndFormatAnswer again
  → If shippable: upsert pool (source still stored as 'gov' | 'ai' per schema; pipeline source remains 'gov' for this path in API payload)

Layer 4 — AI fallback
  → callAIFallback → validateAnswer → if shippable: upsert pool (source 'ai'), return with estimated AI cost

Layer 5 — Escalate
  → success: false, escalate: true, reason + errors (no automatic legal_cases row today — see spec deltas)
```

**API response shape (success):** `success`, `answer`, `metadata`, `source`, `layersTried`, `estimatedCostGbp`, and optional `document: { fileName, mimeType, base64 }` when `includeDocument: true`.

**Escalation HTTP status:** `422` when `errors` present, otherwise `200` with `escalate: true` (see `app/api/answer/route.ts`).

---

## Code reference (accurate snippets)

### Content hash

```8:11:lib/qa-pool/content-hash.ts
export function computeContentHash(question: string, jurisdiction: string): string {
  const key = `${jurisdiction}|${normaliseQuestion(question)}`;
  return createHash('sha256').update(key, 'utf8').digest('hex');
}
```

### Pool service (columns)

- Table: `qa_pool_entries` with `content_hash`, `jurisdiction`, `question_text`, `answer` (JSONB), `source` (`'gov' \| 'ai'`), timestamps.  
- Reads/writes go through `findCachedUserAnswer` / `upsertCachedUserAnswer` in `lib/qa-pool/service.ts`.

### Cost log (columns)

- Table: `answer_cost_logs` with `layer`, `est_cost_gbp`, `content_hash`, `jurisdiction`, `meta`, `occurred_at` — see `lib/answer/cost-log.ts` and migration `007-qa-pool.sql`.

### ACAS layer

Uses the shared GOV.UK wrapper, not a raw `fetch` in `acas-guidance.ts`:

```7:16:lib/gov-apis/acas-guidance.ts
export async function queryAcasGuidance(question: string): Promise<GovAPIResult[]> {
  const rows = await queryGovUKAPI(`ACAS ${question}`);
  const acas = rows.filter(
    (r) =>
      r.url.toLowerCase().includes('acas.org.uk') ||
      r.title.toLowerCase().includes('acas') ||
      r.content.toLowerCase().includes('acas')
  );
  if (acas.length > 0) return acas.slice(0, 8);
  return rows.slice(0, 5);
}
```

---

## Test and build

```bash
npm test -- --passWithNoTests
# Expect: 106 tests, 30 suites

npm run build
# Expect: clean production build
```

Coverage percentage moves with the tree; use `npm run test:ci` locally for CI-parity coverage.

---

## Spec deltas (honest)

| Topic | Spec / earlier doc | Repo reality |
|-------|-------------------|--------------|
| Semantic / pgvector | Cosine similarity cache | Exact hash only; migration file comments optional pgvector path |
| Q&A pool columns | `question_hash`, flat text fields | `content_hash` + JSONB `answer` + `question_text` + `source` check |
| Cost storage | `legal_cases.costs` or case-scoped rows | `answer_cost_logs` keyed by hash/jurisdiction + JSON `meta` (no `case_id` in Step 7) |
| `/api/axiom/qa-pool` | Direct cache API | Intentionally internal to `/api/answer` |
| Layer 5 | “Save to legal_cases” | **Not implemented** — API returns `escalate: true`; persistence to `legal_cases` is a future step |
| DOCX content | Generic title/body | Structured sections from `UserAnswer` (`law`, `meaning`, `action`, `source`, disclaimer) |

---

## Deployment checklist

### Before merge

- [ ] `npm test -- --passWithNoTests` — 106 green  
- [ ] `npm run build` — clean  
- [ ] PR reviewed on GitHub  

### After merge

- [ ] CI/CD: staging deploy (per `.github/DEVOPS.md` variables/secrets)  
- [ ] Supabase: run `lib/supabase/migrations/007-qa-pool.sql` in SQL editor  
- [ ] Smoke: `POST /api/answer` on staging (see below)  

### Staging smoke (`curl`)

```bash
curl -sS -X POST "https://staging.rightsnow.app/api/answer" \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"I was dismissed without notice. What are my rights?\",\"jurisdiction\":\"england_wales\",\"includeDocument\":true}"
```

Expect JSON with `success`, `layersTried`, `estimatedCostGbp`, and when `includeDocument` is true a `document` object including `fileName`, `mimeType`, and `base64`.

---

## Next engineering steps

1. Push `phase0/step7-qa-pool` and open **“Phase 0 Step 7: Q&A pool + answer orchestrator”** PR.  
2. Merge after checks green.  
3. Apply SQL migration in Supabase.  
4. Phase 0 Step 8a/8b: consume `/api/answer`; add streaming and case persistence where the product spec requires it.  

---

## Future: semantic cache (pgvector)

When embeddings are available:

1. Extend `qa_pool_entries` with an embedding column + index (see comment in `007-qa-pool.sql`).  
2. Add embedding helper + RPC for similarity search.  
3. Insert semantic lookup **before** or **after** exact hash in `orchestrator.ts` with a strict similarity threshold.  
4. Expand tests for near-duplicate questions.

No rework of the exact-hash path is required to add this later.

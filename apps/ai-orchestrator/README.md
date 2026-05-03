# IterLaw — `ai-orchestrator`

Backend service for the IterLaw legal review pipeline: fact extraction (AEE), mock RAG, deterministic tribunal-style reasoning, risk scoring, compensation scaffolds, and action planning (LVC).

## Phased implementation plan

| Phase | Scope | Status in this repo |
|-------|--------|---------------------|
| **1 — RAG foundation** | `src/rag/*` — source registry, chunk types, mock ingestion/retrieval, citation helpers. No live scraping; embeddings/pgvector later. | **Scaffolded** |
| **2 — Legal reasoning** | `src/reasoning/*` — claim detection, Burchell / ACAS / limitation / evidence-weight scaffolds, tribunal test definition files, `legal-reasoning.engine.ts`. | **Scaffolded** |
| **3 — Compensation** | `src/compensation/*` — unfair dismissal basic award (ERA length-of-service rules), compensatory scaffold, ACAS uplift, Polkey, contributory, schedule of loss. Caps: **£751** week’s pay and **£123,543** max compensatory from **6 April 2026** (verify at run time in production). | **Scaffolded** |
| **4 — Pipeline** | `legal-review.pipeline.ts` wires AEE → RAG → reasoning → risk → compensation → LVC → safety. `/api/review` returns `LegalReviewApiResponse`. | **Done** |
| **5 — Safety** | `src/safety/review-safety.ts` — disclaimer, confidence heuristic, citation / solicitor flags. | **Done** |
| **6 — Tests** | `tests/review-engines.test.ts` — risk, Burchell, claim detection, reasoning + RAG, compensation hints, basic award. | **Done** |
| **7 — Deferred** | Live scraping, Supabase/pgvector, auth, payments, frontend — **not in this package**. AEE/ART use **mock extraction/reasoning only** (no OpenRouter in this build). | **N/A** |

## How to run

```bash
cd apps/ai-orchestrator
npm install
npm run dev
```

- Health: `GET http://localhost:3001/health`
- Ready: `GET http://localhost:3001/ready`
- Review: `POST http://localhost:3001/api/review` with JSON `{ "text": "...", "module": "employment-law" }`

Production build:

```bash
npm run build
npm start
```

Tests:

```bash
npm run test
```

## Logs

Each request gets a `requestId` (`X-Request-Id` header). Structured JSON lines are emitted for `input`, `aee_output`, `legal_reasoning_output`, `risk_output`, `compensation_output`, and `final_output` (see `logJsonRecord`).

## Environment

| Variable | Purpose |
|----------|---------|
| `PORT` | Listen port (default `3001`). |

## API response shape (Phase 4)

See `src/types/review-api.types.ts` — fields include `module`, `facts`, `claims`, `legalReasoning`, `risk`, `compensation`, `citations`, `evidenceGaps`, `nextSteps`, `documentsToGenerate`, plus `disclaimer`, `confidenceScore`, and `safetyFlags`.

This is **not legal advice**. Always involve a regulated solicitor for strategy, limitation dates, and court / tribunal work.

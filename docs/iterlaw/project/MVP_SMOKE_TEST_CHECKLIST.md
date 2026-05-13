# IterLaw MVP Smoke Test Checklist

> **MVP smoke ≠ production-ready.** Passing this checklist confirms the code surface compiles, lints, builds, tests cleanly, and refuses to bypass the legal-safety gates. It does **not** mean live infrastructure is verified, the live answer path is approved, or the live backup/restore/deployment is authorised. Production readiness is governed by [`PRODUCTION_READINESS_GATE.md`](PRODUCTION_READINESS_GATE.md) — not by this checklist.

## How to run

```
pwsh -File scripts/smoke/iterlaw-mvp-smoke.ps1
```

The script is **read-only** with respect to network, DB, K3s, and external LLMs. It does not deploy. It does not call `kubectl`. It does not call Anthropic / OpenAI / Gemini.

## Checks

| # | Check | Type | Command | Required outcome |
|---|---|---|---|---|
| 1 | Web typecheck | static | `npm run typecheck` (root → `@iterlaw/web` `tsc --noEmit`) | exit 0 |
| 2 | Web lint | static | `npm run lint` | exit 0, `✔ No ESLint warnings or errors` |
| 3 | Web build | static | `npm run build` (Next.js + post-next-standalone) | exit 0 |
| 4 | Root jest tests | runtime | `npm test` | exit 0; current baseline 41 suites / 185 tests |
| 5 | legal-orchestrator typecheck | static | `cd apps/legal-orchestrator && npm run typecheck` | exit 0 |
| 6 | legal-orchestrator build | static | `cd apps/legal-orchestrator && npm run build` | exit 0 |
| 7 | legal-orchestrator vitest | runtime | `cd apps/legal-orchestrator && npm test` | exit 0; current baseline 73 files / 912 tests |
| 8 | External LLM blocked by default in web | grep | grep `ITERLAW_WEB_AI_FALLBACK_ENABLED` + `isWebAiFallbackEnabled` in `apps/web/lib/ai/{claude,gemini,orchestrate}.ts` | refusal gate present in all three |
| 9 | Transport deny list in orchestrator | grep | grep `api.openai.com`, `api.anthropic.com`, etc. in `apps/legal-orchestrator/src/legal/llm/localTransportPolicy.ts` | hosts in deny list |
| 10 | `citation_required` enforced | grep | grep in `apps/legal-orchestrator` | non-zero hit count in source + tests |
| 11 | `zero_citation_answer_blocked` enforced | grep | grep in `apps/legal-orchestrator` | non-zero hit count in source + tests |
| 12 | RAG mode clarity | grep | grep `postgresRetrieval` and `mockRetrieval` in `apps/legal-orchestrator/src/rag/` | both present; mode resolved at runtime by `DATABASE_URL` |
| 13 | No real secret value in repo | grep | grep `DATABASE_URL=.*://|password|token|secret|api_key|apikey` in `docs apps reports` | no real secret committed (token fields like `max_tokens` and explicit "no secret" comments are acceptable) |
| 14 | No false production-ready / deployed claim | grep | grep `PRODUCTION READY|production ready|DEPLOYED|live verified` in `docs PROJECT.md` | only governance / negation / conditional / "if deployed" hits |
| 15 | `/health` reachable when orchestrator is started locally (optional) | runtime | curl `http://localhost:3000/health` after starting orchestrator | exit 0; body is JSON with no DSN/password |
| 16 | `/ready` reachable when orchestrator is started locally (optional) | runtime | curl `http://localhost:3000/ready` after starting orchestrator | exit 0; body contains `citation_required: true`, `zero_citation_answer_blocked: true`; **no `DATABASE_URL` value leaked** |

Checks 15 and 16 require a running orchestrator. If the script is invoked **without** `ITERLAW_MVP_SMOKE_RUN_SERVER=1`, those checks are skipped and recorded as `NOT_RUN` (not a failure).

## What this checklist deliberately does NOT do

- It does **not** deploy.
- It does **not** call `kubectl`.
- It does **not** call any external LLM provider.
- It does **not** touch a production database.
- It does **not** rotate or read production secrets.
- It does **not** declare IterLaw production-ready.

## Companion files

- `scripts/smoke/iterlaw-mvp-smoke.ps1` — runs the checks and writes a timestamped report.
- `reports/ITERLAW_SPRINT_16_MVP_SMOKE_TEST_READINESS.md` — Sprint 16 baseline report.
- `docs/iterlaw/project/PRODUCTION_READINESS_GATE.md` — the actual production-readiness contract (not satisfied by this checklist alone).

# Sprint 16 - MVP smoke test (2026-05-16T19-28-58)

## STATUS: PASS

Pass: 14  Fail: 0  NotRun: 2  Total: 16

| # | Check | Status | Detail |
|---|---|---|---|
| 1 | Web typecheck | PASS | exit=0 |
| 2 | Web lint | PASS | exit=0 |
| 3 | Web build | PASS | exit=0 |
| 4 | Root jest | PASS | exit=0 |
| 5 | Orchestrator typecheck | PASS | exit=0 |
| 6 | Orchestrator build | PASS | exit=0 |
| 7 | Orchestrator vitest | PASS | exit=0 |
| 8 | External LLM blocked by default | PASS | feature flag check on apps/web/lib/ai/{claude,gemini,orchestrate}.ts |
| 9 | Orchestrator transport deny list | PASS | checked openai.com + anthropic.com presence |
| 10 | citation_required enforced in orchestrator | PASS | hits=24 |
| 11 | zero_citation_answer_blocked enforced in orchestrator | PASS | hits=10 |
| 12 | RAG mode clarity (postgres + mock) | PASS | postgresRetrieval=postgresRetrieval.ts mockRetrieval=mockRetrieval.ts |
| 13 | No real secret value in repo (heuristic) | PASS | non-placeholder concrete-secret hits=0 |
| 14 | No false production-ready claim in active docs | PASS | non-negated active hits=0 |
| 15 | /health reachable | NOT_RUN | ITERLAW_MVP_SMOKE_RUN_SERVER not set |
| 16 | /ready reachable + safety flags + no DSN leak | NOT_RUN | ITERLAW_MVP_SMOKE_RUN_SERVER not set |

## Safety properties

- No kubectl. No helm. No systemctl. No firewall. No production DB. No external LLM.
- Live /health and /ready only checked when ITERLAW_MVP_SMOKE_RUN_SERVER=1 and the operator has the orchestrator running locally.
- The script does not start the orchestrator.

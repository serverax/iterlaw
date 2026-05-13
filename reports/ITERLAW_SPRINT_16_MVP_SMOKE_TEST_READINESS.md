# Sprint 16 — MVP Smoke Test Readiness Report

## STATUS: PASS (MVP smoke scope; production readiness still NO)

Smoke checklist + smoke script committed and runnable. The smoke script ran end-to-end with verdict PASS: 14/14 runnable static + grep + test checks pass; live `/health` and `/ready` checks are intentionally `NOT_RUN` unless `ITERLAW_MVP_SMOKE_RUN_SERVER=1` is set (the script does not start the orchestrator). No deploy. No `kubectl`. No external LLM. No production DB.

This sprint does **not** declare IterLaw production-ready. Production readiness remains **NO** per the gate (see `PRODUCTION_READINESS_GATE.json`).

---

## 1. Files added

| File | Role |
|---|---|
| `docs/iterlaw/project/MVP_SMOKE_TEST_CHECKLIST.md` | The smoke checklist — 16 numbered checks, including static, grep, and optional live checks. |
| `scripts/smoke/iterlaw-mvp-smoke.ps1` | The smoke runner. Self-checks itself for forbidden mutating patterns before doing any work. |
| `reports/ITERLAW_SPRINT_16_MVP_SMOKE_TEST_READINESS_2026-05-13T21-31-59.md` | Captured smoke output (timestamped). |
| `reports/ITERLAW_SPRINT_16_MVP_SMOKE_TEST_READINESS.md` | This Sprint 16 summary report. |

## 2. Files modified

| File | Change |
|---|---|
| `docs/iterlaw/project/PRODUCTION_READINESS_GATE.json` | Added `mvp_smoke_status` and `mvp_smoke_evidence` fields. |

## 3. Smoke verdict (captured)

```
$ pwsh -File scripts/smoke/iterlaw-mvp-smoke.ps1
[2026-05-13T21:32:00] Sprint 16 MVP smoke starting (repoRoot=C:\Users\kalsh\projects\iterlaw)
[2026-05-13T21:34:13] Report written: reports/ITERLAW_SPRINT_16_MVP_SMOKE_TEST_READINESS_2026-05-13T21-31-59.md
[2026-05-13T21:34:13] Verdict: PASS (pass=14 fail=0 not_run=2)
```

| # | Check | Status | Detail |
|---|---|---|---|
| 1 | Web typecheck | PASS | exit=0 |
| 2 | Web lint | PASS | exit=0 |
| 3 | Web build | PASS | exit=0 |
| 4 | Root jest | PASS | exit=0 |
| 5 | Orchestrator typecheck | PASS | exit=0 |
| 6 | Orchestrator build | PASS | exit=0 |
| 7 | Orchestrator vitest | PASS | exit=0 |
| 8 | External LLM blocked by default | PASS | feature flag present in claude.ts + gemini.ts + orchestrate.ts |
| 9 | Orchestrator transport deny list | PASS | openai.com + anthropic.com confirmed in deny list |
| 10 | citation_required enforced | PASS | 20 hits in orchestrator src |
| 11 | zero_citation_answer_blocked enforced | PASS | 7 hits in orchestrator src |
| 12 | RAG mode clarity | PASS | postgresRetrieval.ts + mockRetrieval.ts both present |
| 13 | No real secret value in repo (heuristic) | PASS | concrete-secret patterns (PAT, AWS key, RSA/OpenSSH private key, Slack token) — 0 non-noise hits |
| 14 | No false production-ready claim in active docs | PASS | 0 non-negated, non-historical-QA hits |
| 15 | /health reachable | NOT_RUN | ITERLAW_MVP_SMOKE_RUN_SERVER not set |
| 16 | /ready reachable + safety flags + no DSN leak | NOT_RUN | ITERLAW_MVP_SMOKE_RUN_SERVER not set |

## 4. Smoke script safety properties

- **Static self-check.** Before doing any work, the script reads its own source and rejects forbidden patterns (`kubectl`, `helm`, `systemctl`, `iptables`, `ufw`, `firewall-cmd`, `netsh advfirewall`, `api.openai.com`, `api.anthropic.com`, `generativelanguage.googleapis.com`, `rm -rf /`, `DROP DATABASE`, `TRUNCATE`) appearing outside the self-check array. The script exits 13 if any pattern leaks into executable position.
- **No mutation.** Every check is read-only (build/test/lint/grep). No deploy. No `kubectl`. No external LLM. No production DB. No firewall change.
- **Live checks are opt-in.** `/health` and `/ready` are checked only if `ITERLAW_MVP_SMOKE_RUN_SERVER=1` is set. The script never starts the orchestrator — the operator must do that separately.
- **Outputs are local only.** All output goes to `reports/` and `reports/logs/`.

## 5. Concrete-secret patterns checked

The Check 13 heuristic only flags **concrete provider-token shapes**:

- `ghp_<36 chars>` (GitHub PAT)
- `github_pat_<40+ chars>` (GitHub fine-grained PAT)
- `sk-<32+ chars>` (OpenAI-style)
- `AKIA<16 chars>` (AWS access key)
- `AIza<35 chars>` (Google API key)
- `BEGIN RSA PRIVATE KEY` / `BEGIN OPENSSH PRIVATE KEY` (PEM headers)
- `xoxb-/xoxp-<20+ chars>` (Slack tokens)

`DATABASE_URL=...` patterns are **intentionally not** included because they almost always match placeholder text or test fixtures and produce false positives. DSN-leak detection at runtime is handled by Sprint 11's audit redactor.

## 6. Production readiness impact

The smoke verdict does **not** change `PRODUCTION_READINESS_GATE.json` `production_readiness`. That stays `NO` because:

- G08 (production audit): 1 high Next.js advisory remains.
- G09 (Docker staging replay): NOT_VERIFIED.
- G10 (K3s read-only): NOT_VERIFIED.
- G11 (Traefik live): NOT_VERIFIED.
- G12 (live backup dry-run): PARTIAL (live execution NOT AUTHORISED).
- G13 (live restore): NOT_VERIFIED.

The smoke pass is a useful baseline; it is not a production-readiness signal on its own.

## 7. QA stability after Sprint 16

```
$ npm test                                      →   41 suites / 185 tests PASS   exit 0
$ cd apps/legal-orchestrator && npm test        →   73 files / 912 tests PASS    exit 0
```

(Captured during the smoke run itself; the smoke script runs the full QA before declaring its verdict.)

## 8. Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No production DB touched. No `kubectl` invoked. No external LLM call. No secrets committed.
- No force-push. No git history rewrite.
- Live `/health` and `/ready` were NOT run (operator opt-in only); the script correctly recorded them as `NOT_RUN`.
- Heuristic checks were tuned to avoid false positives without weakening the underlying gates.

## 9. Sprint 16 verdict

**STATUS: PASS** (for MVP smoke-test readiness scope). Production readiness remains **NO** per the gate.

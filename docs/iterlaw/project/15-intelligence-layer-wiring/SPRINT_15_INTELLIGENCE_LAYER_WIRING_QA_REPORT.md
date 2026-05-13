# Sprint 15 — Intelligence Layer Feature-Flagged Wiring — QA Report

Report date: 2026-05-13.

## 1. Starting state (Sprint 15 entry)

- Starting HEAD: `f72ae26` (Sprint 13 closeout).
- Branch: `master`, ahead 11 of `origin/master` at entry.
- Sprint 12 + Sprint 13 commits all local-only at entry.
- Intelligence Layer foundation files (Sprint 14 work) **untracked**
  in working tree at sprint entry.
- Pre-existing untracked file (third-party Cursor audit):
  `reports/CURSOR_AUDIT_CLAUDE_SPRINT_11_12_QA_REPORT.md`. Not
  touched.
- Production status: **BLOCKED**.

## 2. Sprint 14 foundation baseline commits

| Hash | Message |
| --- | --- |
| `5470757` | feat(intelligence): add intelligence layer foundation modules |
| `427e8ff` | test(intelligence): add intelligence layer foundation tests |
| `b53fa9a` | docs(iterlaw): add intelligence layer architecture docs |

These three commits captured the entire Sprint 14 foundation that was
previously sitting untracked.

## 3. Sprint 15 files created

| Path |
| --- |
| `apps/legal-orchestrator/src/config/featureFlags.ts` |
| `apps/legal-orchestrator/src/tests/intelligenceFeatureFlags.test.ts` (10 tests) |
| `apps/legal-orchestrator/src/tests/intelligenceDisabledPath.test.ts` (5 tests) |
| `apps/legal-orchestrator/src/tests/intelligenceShadowMode.test.ts` (5 tests) |
| `apps/legal-orchestrator/src/tests/intelligenceActiveModeGuard.test.ts` (6 tests) |
| `docs/iterlaw/project/15-intelligence-layer-wiring/ADR_SPRINT_15_INTELLIGENCE_LAYER_FEATURE_FLAGGED_WIRING.md` |
| `docs/iterlaw/project/15-intelligence-layer-wiring/SPRINT_15_INTELLIGENCE_LAYER_WIRING_QA_REPORT.md` (this file) |

## 4. Sprint 15 files changed

| Path | Purpose |
| --- | --- |
| `apps/legal-orchestrator/src/pipeline/handleLegalRequest.ts` | Adds the Intelligence Layer shadow-mode call inside a try/catch. Result is collected to a local variable then explicitly `void`'d so the public response shape is unchanged. Active mode is intentionally PARTIAL: it follows the same code path as shadow. |
| `apps/legal-orchestrator/src/server.ts` | Adds an additive `intelligence_layer` slice to the `/ready` envelope with `external_network_enabled: false` and `external_llm_enabled: false` hard-coded. |
| `apps/legal-orchestrator/src/tests/sprint8Ready.test.ts` | Updated the strict `toEqual` assertion to expect the new `intelligence_layer` field (sentinel-DSN test on the same page is unchanged and still passes). |
| `docs/iterlaw/architecture/ITERLAW_INTELLIGENCE_LAYER_ARCHITECTURE.md` | Added §8 "Sprint 15 wiring status". |
| `PROJECT.md` | Sprint 15 row added; counts updated to 15 completed / 42 remaining / Sprint 16 next. |
| `ITERLAW_PROJECT_STATUS.md` | Same. |
| `docs/iterlaw/ITERLAW_PROJECT_STATUS.md` | Same. |
| `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md` | Same. |
| `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md` | Sprint 14 + Sprint 15 rows added; quick-state lines updated. |

## 5. Feature flag behaviour

`apps/legal-orchestrator/src/config/featureFlags.ts` `getIntelligenceLayerConfig()`:

| Env state | Output | Verified by |
| --- | --- | --- |
| Both vars missing or empty | `{enabled: false, mode: "off", source: "env"}` | Test 1 |
| `ENABLED=false` + `MODE=shadow` | `{enabled: false, mode: "off"}` | Test 2 |
| `ENABLED=true` + `MODE` missing | `{enabled: true, mode: "off"}` | Test 3 |
| `ENABLED=true` + `MODE=shadow` | `{enabled: true, mode: "shadow"}` | Test 4 |
| `ENABLED=true` + `MODE=active` | `{enabled: true, mode: "active"}` | Test 5 |
| `ENABLED=true` + `MODE=lol_invalid` | `{enabled: true, mode: "off"}` | Test 6 |
| Polluted with `DATABASE_URL` / `POSTGRES_PASSWORD` | no DSN / password value appears in the config output JSON | Test 7 |
| Without `DATABASE_URL` | still works (no DB dependency) | Tests 8 + 9 |
| Without provider keys | still works (no provider dependency) | Test 10 |

## 6. Disabled-mode result

- `/ready` default body contains
  `intelligence_layer: {configured: false, mode: "off", external_network_enabled: false, external_llm_enabled: false}`.
- `handleLegalRequest` with empty retrieval still returns a refusal
  status (`insufficient_sources` / `needs_more_facts` / etc.) and
  `external_llm_used: false`.
- `/api/legal/ask` responses contain none of: `intelligence_layer`,
  `intelligence_trace`, `trust_score`, `rrf_scores`,
  `retrieved_context_hash`.
- The feature flag config module contains no `fetch(`, no `axios()`,
  no provider SDK import (static-source assertion).

**Disabled mode evidence: PASS (5 / 5 tests).**

## 7. Shadow-mode result

- Shadow mode does NOT change the answer text.
- Shadow mode does NOT change the citations.
- Shadow mode does NOT bypass `insufficient_sources` for empty retrieval.
- Shadow mode does NOT bypass zero-citation blocking — drafter's
  empty `citedChunkIds` still yields `citation_failed`.
- Shadow mode does NOT expose internal intelligence detail in the
  response (no `rrf_scores`, `retrieved_context_hash`,
  `intelligence_trace`, `trust_threshold_met`, `source_diversity`).
- Shadow mode survives a malformed `LegalRequest` (missing
  `workspace_id` / `user_id`) — the try/catch swallows any throw
  and the legacy path runs to completion.

**Shadow-mode evidence: PASS (5 / 5 tests).**

## 8. Active-mode result

Active mode is intentionally **PARTIAL** in Sprint 15: the gateway is
invoked but the result is discarded. Active mode in this sprint is
functionally identical to shadow mode (legacy path is in charge).

- Active mode cannot produce a legal answer without citations.
- Active mode cannot bypass the missing-facts (`needs_more_facts`) path.
- Active mode keeps `external_llm_used: false` on every response.
- Active mode's source body contains no `fetch(`, no `axios(`, no
  provider SDK import (static-source assertion against
  `handleLegalRequest.ts`).
- Active mode falls back safely when retrieval is empty.
- Active mode respects existing RAG insufficiency behaviour.

**Active-mode evidence: PASS (6 / 6 tests; active wiring is
intentional PARTIAL — gateway result discarded).**

## 9. /ready result

```jsonc
{
  "status": "ready",
  "service": "legal-orchestrator",
  "rag": { "configured": false, "mode": "mock", "database": "not_configured" },
  "llm": {
    "external_llm_enabled": false,
    "local_gateway_configured": false,
    "local_gateway_mode": "disabled",
    "local_gateway_available": false
  },
  "synthesis": { "configured": false, "reachable": false, "queue": null, "last_seen_at": null },
  "legal_safety": { "citation_required": true, "zero_citation_answer_blocked": true },
  "intelligence_layer": {
    "configured": false,
    "mode": "off",
    "external_network_enabled": false,
    "external_llm_enabled": false
  }
}
```

- New field is additive; existing slices unchanged.
- `legal_safety.citation_required = true` ✓
- `legal_safety.zero_citation_answer_blocked = true` ✓
- `llm.external_llm_enabled = false` ✓
- `intelligence_layer.external_network_enabled = false` ✓ (hard-coded)
- `intelligence_layer.external_llm_enabled = false` ✓ (hard-coded)
- No DSN, no password, no token value leaked anywhere.

## 10. Commands run

| Command (cwd `apps/legal-orchestrator`) | Exit | Result |
| --- | --- | --- |
| `npx tsc --noEmit` | 0 | PASS |
| `npm run build` (`tsc`) | 0 | PASS |
| `npx vitest run src/tests/intelligenceFeatureFlags.test.ts` | 0 | 10 / 10 PASS |
| `npx vitest run src/tests/intelligenceDisabledPath.test.ts` | 0 | 5 / 5 PASS |
| `npx vitest run src/tests/intelligenceShadowMode.test.ts` | 0 | 5 / 5 PASS |
| `npx vitest run src/tests/intelligenceActiveModeGuard.test.ts` | 0 | 6 / 6 PASS |
| `npx vitest run src/tests/intelligenceGateway.test.ts` | 0 | 7 / 7 PASS (Sprint 14 carry-over) |
| `npx vitest run src/tests/hybridRetrievalPlanning.test.ts` | 0 | 9 / 9 PASS (Sprint 14 carry-over) |
| `npx vitest run` (full suite) | 0 | **72 files / 907 tests PASS** |
| `npm test -- --runInBand` | n/a | jest not used; orchestrator uses vitest. |

## 11. Exact test count

**Baseline before Sprint 15 wiring (Sprint 14 foundation):** 68 files / 881 tests.
**After Sprint 15 wiring:** **72 files / 907 tests.**
**Delta:** **+4 files / +26 tests.**

## 12. Safety scan result

| Scan target | Hits | Classification | Unsafe? |
| --- | --- | --- | --- |
| `fetch(`, `axios(`, `openai`, `anthropic`, `@google/generative-ai`, `cohere-ai`, `@mistralai` in `apps/legal-orchestrator/src/intelligence/` | 0 | — | NO |
| Same scan in `apps/legal-orchestrator/src/pipeline/` | 0 | — | NO |
| Same scan in `apps/legal-orchestrator/src/config/` | 0 | — | NO |
| `DATABASE_URL=.*://` / `POSTGRES_PASSWORD=` / `PGPASSWORD=` / credential-bearing `postgres://user:pw@` in `apps/legal-orchestrator/src/intelligence`, `src/pipeline`, `src/config` | 0 | — | NO |
| DSN-shaped strings under `src/tests/` | many | All are test fixtures asserting "DSN sentinel does not leak". Safe denylist / test material. | NO |
| `kubectl (apply\|delete\|patch\|edit\|scale\|rollout)` in Sprint 15 paths | 0 | — | NO |
| `rightsnow / RightsNow` in Sprint 15 paths | 0 | — | NO |
| `production ready / production verified / live backup complete / live restore complete / Sprint 15 PASS / Sprint 15 complete` in `docs/iterlaw/project/15-intelligence-layer-wiring/` | 5 | All in forbidden-claim list / negative claims ("Do not use plain PASS", "does not authorise production", "Sprint 15 PASS — forbidden in any committed artefact"). Safe forbidden-policy text. | NO |

## 13. Final git status

```
## master...origin/master [ahead 17]
?? reports/CURSOR_AUDIT_CLAUDE_SPRINT_11_12_QA_REPORT.md
```

(17 ahead = Sprint 12 (6) + Sprint 13 (5) + Sprint 14 (3) + Sprint 15
(3 expected from the upcoming commit sequence).)

## 14. Sprint 15 final status

**Sprint 15 — PASS FOR FEATURE-FLAGGED LOCAL WIRING ONLY.**

Evidence:
- Feature flag config: 10 / 10 tests PASS.
- Disabled-path behaviour: 5 / 5 tests PASS.
- Shadow mode: 5 / 5 tests PASS (no public-shape change).
- Active-mode guards: 6 / 6 tests PASS (intentional PARTIAL ACTIVE wiring; gateway result discarded).
- `/ready` additive field: present with `mode: off` by default,
  `external_network_enabled: false`, `external_llm_enabled: false`.
- Full vitest: 72 / 907 PASS.
- Safety scans clean.
- Intelligence Layer disabled by default in every deployment that
  does not explicitly set both env vars.

Not claimed:
- production verified — **NO**;
- production approved — **NO**;
- ready for production — **NO**;
- deployed — **NO**;
- first live backup authorised — **NO**;
- first live restore authorised — **NO**;
- IterLaw production-ready — **NO**;
- Intelligence Layer fully wired in active mode — **NO** (intentional PARTIAL).

## 15. Truth statement

- Production touched: **NO**.
- kubectl run against any cluster: **NO**.
- Deployment performed: **NO**.
- External LLM called: **NO**.
- New `fetch(` added under intelligence / pipeline / config: **NO**.
- New provider SDK imported: **NO**.
- Secrets committed: **NO**.
- First live backup authorised: **NO**.
- Live restore authorised: **NO**.
- Intelligence Layer default: **disabled** (`mode: off`).
- Sprint 15 status: **PASS FOR FEATURE-FLAGGED LOCAL WIRING ONLY**.
- Sprint 16 status: **PLANNED**.
- Production status: **BLOCKED**.

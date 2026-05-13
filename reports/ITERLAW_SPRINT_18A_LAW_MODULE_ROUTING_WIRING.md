# Sprint 18A — Law Module Routing Feature-Flagged Wiring Report

## STATUS: PASS

Feature flag `ITERLAW_LAW_MODULE_ROUTING_ENABLED` (default OFF) wired into `handleLegalRequest`. When OFF, behaviour unchanged; when ON, registry consulted to confirm active module + decision trace recorded as telemetry only. 11/11 new tests PASS. Orchestrator suite **76 files / 948 tests PASS**. Root jest **41/185 PASS**. No false multi-module claim.

---

## 1. Files added

- `apps/legal-orchestrator/src/lawModuleEngine/legalModuleRouting.ts` — routing adapter.
- `apps/legal-orchestrator/src/tests/legalModuleRoutingFlag.test.ts` — 11 vitest cases.

## 2. Files modified

- `apps/legal-orchestrator/src/config/featureFlags.ts` — added `getLawModuleRoutingConfig()` + docs constant.
- `apps/legal-orchestrator/src/pipeline/handleLegalRequest.ts` — added flag-guarded routing block. Shadow-only.
- `apps/legal-orchestrator/src/retrieval/index.ts` — re-exports the multi-tier gateway (added now so the handleLegalRequest wiring resolves; the gateway itself belongs to Sprint 19A).
- `docs/iterlaw/architecture/ITERLAW_LAW_MODULE_ENGINE_ARCHITECTURE.md` — Sprint 18A wiring section.

## 3. Feature-flag contract

- `ITERLAW_LAW_MODULE_ROUTING_ENABLED` defaults to OFF.
- Recognised ON values: `"true"`, `"TRUE"`, `"1"`, `"yes"`, `"on"` (case-insensitive, trim-tolerant).
- Anything else → OFF.
- Failure inside the routing block collapses to "no routing trace this turn"; the answer path is never broken.

## 4. Behaviour matrix

| Flag value | Behaviour |
|---|---|
| Unset | Routing not invoked. No change. Default Sprint 17 / Sprint 11 / Sprint 15 behaviour. |
| `false` / `0` / arbitrary | Same as unset. |
| `true` / `1` / `yes` / `on` | `routeLegalRequestToModule({})` is invoked. Default scope = UK_ENGLAND_WALES + employment. Decision trace recorded as `lawModuleRoutingTrace` and intentionally NOT placed on the public response. |

## 5. Test evidence

```
$ npx vitest run src/tests/legalModuleRoutingFlag.test.ts
✓ src/tests/legalModuleRoutingFlag.test.ts (11 tests)
Test Files  1 passed (1)
     Tests  11 passed (11)
exit 0
```

Cases:

- Flag defaults to OFF when unset.
- Flag OFF for empty / "false" / "0" / "no" / arbitrary.
- Flag ON only for explicit "true" / "1" / "yes" / "on" (case-insensitive).
- `routeLegalRequestToModule({})` defaults to UK Employment.
- Explicit `uk_employment` is accepted.
- All eight planned modules refused with `error.kind === "inactive_module"`.
- Unknown moduleId returns `unknown_module`.
- Decision trace records `citation_required:true` and `zero_citation_answer_blocked:true`.
- Decision trace records `law_module_routing:active:uk_employment` on success.
- Decision trace records `law_module_routing:refused:inactive_module` for planned modules.
- Static source-scan confirms no `fetch / axios / http / openai / anthropic / gemini` in the routing module.

## 6. Full QA

```
$ npm run typecheck                              →   exit 0
$ npm run lint                                   →   exit 0
$ npm run build                                  →   exit 0
$ npm test                                       →   41 suites / 185 tests PASS   exit 0
$ cd apps/legal-orchestrator && npm run typecheck →   exit 0
$ cd apps/legal-orchestrator && npm run build    →   exit 0
$ cd apps/legal-orchestrator && npm test         →   76 files / 948 tests PASS    exit 0   (+1 file / +11 tests over Sprint 19 baseline)
```

## 7. Truth statement

- Worked only in `C:\Users\kalsh\projects\iterlaw`.
- No deploy. No `kubectl`. No production DB touched. No external LLM call. No secrets committed.
- No force-push. No git history rewrite.
- Flag is OFF by default. With the flag OFF the answer path is byte-identical to pre-18A behaviour (no new branch executes).
- With the flag ON, the routing trace is recorded only as telemetry and is NOT placed on the public response (preserves `/api/legal/ask` shape).
- UK Employment is the **only** active module. Planned modules are refused with `error.kind === "inactive_module"`.
- Citation gates (`citation_required`, `zero_citation_answer_blocked`) remain enforced downstream.

## 8. Sprint 18A verdict

**STATUS: PASS** — feature-flagged wiring exists, tests pass, default behaviour unchanged.

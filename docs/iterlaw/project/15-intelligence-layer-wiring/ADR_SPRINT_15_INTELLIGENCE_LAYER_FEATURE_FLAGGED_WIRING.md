# ADR — Sprint 15 — Intelligence Layer Feature-Flagged Wiring

## Status

**Accepted (Sprint 15 scope — FEATURE-FLAGGED LOCAL WIRING ONLY).**

This ADR is accepted for the artefacts it produces. It does **NOT**
authorise:

- Switching the Intelligence Layer on by default.
- Any production deployment.
- Any production database touch.
- Any external LLM call.
- Any new `fetch(` or external SDK import in the orchestrator.
- Any change to the canonical Kubernetes namespaces.
- Any change to the first-live-backup authorisation state (remains
  NO).

## Context

Sprint 14 landed a pure-function Intelligence Layer foundation under
`apps/legal-orchestrator/src/intelligence/`. The layer is mock-safe
and unit-tested, but unreferenced by the production answer path.
Sprint 15 wires the layer in **safely**, behind an env-driven feature
flag that is **OFF by default**, and behind two safety modes
(`shadow` / `active`) that share the same hard rule: the layer **must
not bypass any existing legal-safety gate**.

## Decision

Add a feature flag config module
(`apps/legal-orchestrator/src/config/featureFlags.ts`) that reads two
env vars:

| Env var | Allowed values | Default | Effect |
| --- | --- | --- | --- |
| `ITERLAW_INTELLIGENCE_LAYER_ENABLED` | `true` / `false` / missing | `false` | Hard switch. False / missing / invalid → layer disabled. |
| `ITERLAW_INTELLIGENCE_LAYER_MODE` | `off` / `shadow` / `active` / missing / invalid | `off` | Mode. Anything except an explicit `shadow` / `active` value collapses to `off`. |

`getIntelligenceLayerConfig()` returns one of:

- `{enabled: false, mode: "off", source: "env"}` — default.
- `{enabled: true, mode: "off", source: "env"}` — enabled flag set but no explicit mode.
- `{enabled: true, mode: "shadow", source: "env"}` — explicit opt-in to shadow.
- `{enabled: true, mode: "active", source: "env"}` — explicit opt-in to active.

### Wiring

`handleLegalRequest` reads the config once per request, after chunks
are retrieved and before the prompt is built. When the mode is
`shadow` or `active` it converts the retrieved chunks to
`IntelligenceRetrievalCandidate` shapes, invokes
`runIntelligenceGateway`, and **discards the result** (assigned to a
local variable then explicitly `void`'d).

- **Shadow:** invokes the gateway for telemetry only. Public response
  unchanged. Legacy answer-path produces the response.
- **Active (PARTIAL in Sprint 15):** also invokes the gateway. The
  result is also discarded. Active mode does NOT yet rewrite
  retrieval, ranking, or evidence. Until active wiring is proven by a
  dedicated sprint, it is functionally identical to shadow.

Any error inside the intelligence layer is caught and silently
collapsed. The legacy answer path runs to completion regardless.

### `/ready` extension

The `/ready` envelope grows one new field:

```json
"intelligence_layer": {
  "configured": false,
  "mode": "off",
  "external_network_enabled": false,
  "external_llm_enabled": false
}
```

`configured` mirrors `enabled` from the config. `mode` mirrors the
parsed mode. `external_network_enabled` and `external_llm_enabled`
are hard-coded `false` — even if the operator sets the mode to
`active`, the layer cannot reach an external network from within
this orchestrator binary, and the `/ready` envelope must always be
truthful about that.

## Why feature-flagged

- The Intelligence Layer is new. Its modules are unit-tested but
  not yet integration-tested at scale.
- Existing answer-path safety (citation gate, immediate-risk check,
  deadline check, RAG insufficiency, zero-citation-block) is mature
  and depended on by every Sprint 8+ test.
- Wiring the layer ON-by-default risks regressing the established
  refusal behaviour in subtle ways (rank order, source-type
  classification, freshness assessment).
- A default-off, env-flagged opt-in lets operators turn the layer on
  for a single workspace / pod / shell while leaving production
  defaults unchanged.

## Shadow mode purpose

- Capture an `IntelligenceDecisionTrace` for every request, so we
  can compare what the Intelligence Layer **would have decided**
  against what the legacy pipeline actually produced.
- Detect regressions early: if shadow's `decision === "block"` for a
  request that legacy answered cleanly, that's a signal for
  investigation.
- No public exposure. The trace stays inside the orchestrator
  process; future sprint wires it into a redacted audit envelope.

## Active mode guardrails

Active mode in Sprint 15 is **intentionally partial**: the gateway
is invoked but the result is discarded. The legacy path remains in
charge. This is enforced by:

- `handleLegalRequest` never reading the gateway's evidence /
  decision / trace.
- The added `void intelligenceShadowResult;` statement, which
  documents the discard.
- A `try/catch` that swallows any gateway error so the legacy path
  is never destabilised.

A future sprint may extend active mode to pass the gateway's
compressed evidence pack to `handleLegalRequest` via a new
(additive) deps field, behind its own ADR.

## Legal safety priority

In any conflict between ranking quality and legal safety, **legal
safety wins**. The Intelligence Layer cannot bypass:

- the citation gate (zero-citation legal claim → block),
- the immediate-risk check (`needs_more_facts` / `high_risk_deadline`),
- the deadline / limitation-date warnings,
- the RAG insufficiency check (`insufficient_sources` when no
  evidence is available),
- the legal-mode demotions in `trustScorer.ts` (draft + architecture
  cannot outrank statutory / tribunal sources).

These rules are enforced by the existing pipeline and by the
intelligence layer's own modules. Sprint 15 does not change any of
them.

## Fallback behaviour

If the intelligence gateway throws OR returns an unexpected shape
OR is invoked with malformed input, the orchestrator silently
returns to the legacy answer path. No public-side error appears in
the response. No internal trace is exposed. The legacy refusal
machinery (citation gate, etc.) is unaffected.

## Forbidden

- `ITERLAW_INTELLIGENCE_LAYER_ENABLED=true` in production deployment
  manifests — not added.
- New `fetch(` or `axios()` calls in
  `apps/legal-orchestrator/src/intelligence/`,
  `apps/legal-orchestrator/src/pipeline/`,
  `apps/legal-orchestrator/src/config/`.
- New provider SDK imports in any of the above directories.
- Reading or printing any DSN, password, token, or API key.
- Any `kubectl` shell-out.
- Any production claim ("production verified", "production approved",
  "ready for production", "deployed", "Sprint 15 PASS",
  "Sprint 15 complete") in committed artefacts.

## Evidence required for PASS

- 26 new Sprint 15 tests green
  (`intelligenceFeatureFlags.test.ts`,
  `intelligenceDisabledPath.test.ts`,
  `intelligenceShadowMode.test.ts`,
  `intelligenceActiveModeGuard.test.ts`).
- Full vitest suite green at **72 files / 907 tests PASS** (Sprint 14
  baseline 68/881 → +4 files / +26 tests).
- Existing `/ready` envelope tests updated to expect the additive
  `intelligence_layer` field. Sentinel-DSN tests still PASS — the
  field carries no env value.
- Safety scans clean.

## Production status

**BLOCKED.** Sprint 15 does not unblock production. First live backup
remains **NOT AUTHORISED**. Live restore remains **NOT AUTHORISED**.

## Truth statement

- This ADR does not authorise live wiring beyond shadow mode.
- This ADR does not authorise any production touch.
- This ADR keeps Intelligence Layer disabled by default.
- This ADR keeps the `/ready` envelope honest:
  `external_network_enabled: false`, `external_llm_enabled: false`.

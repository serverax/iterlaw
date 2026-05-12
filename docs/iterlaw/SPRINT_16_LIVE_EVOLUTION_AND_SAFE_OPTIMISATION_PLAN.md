# Sprint 16 — Live Evolution and Safe Optimisation

Status: **Planned / Future.** Not started, not deployed, not executed.

> Every numeric, performance, or status claim in the proposal that
> motivated this sprint (02:00 trigger, 240ms inference, 68°C CPU,
> Wasm-AOT active, GraphRAG depth 4-hop, 42/128 GB memory buffer,
> autonomous DSPy prompt adjustment, autonomous tribunal filing) is
> **a target capability of this sprint, not the current state of the
> system.** Nothing in this document is operational at the time of
> writing.

## Objective

Build a controlled, auditable nightly evaluation and optimisation
framework for IterLaw. The system may analyse decision traces, detect
reasoning defects, generate synthetic scenarios, propose prompt/rule
improvements, and identify systemic legal patterns. **It must not
mutate production behaviour without human approval.**

---

## 1. Scope

- Nightly evaluation CronJob design (proposed manifest, not applied).
- Decision ledger sampling against trusted test scenarios.
- Synthetic Scenario Vault (anonymised; never enters trusted corpus).
- Statutory truth regression tests.
- Paradox detection tests (see §4).
- DSPy prompt-candidate generation against captured failures.
- Prompt registry and version pinning.
- HITL approval gate before any candidate is activated in production.
- Rollback support for any activated candidate.
- Anonymised cross-case synthesis (see §6).
- Grafana / Prometheus metric contracts (see §10) — defined but never
  populated with fake values.

## 2. Non-negotiable safety rules

- **No autonomous code commit.** Every code change goes through PR.
- **No autonomous production deployment.** Apply is operator-only.
- **No direct prompt overwrite.** Candidates land in a registry,
  never in the live prompt path, until HITL approval is recorded.
- **No external LLM call from the orchestrator request path.** The
  evolution job may call internal models for analysis; it may not
  inject external-LLM output into a user-facing legal answer.
- **No legal answer without verified citation.** The citation gate
  in `apps/legal-orchestrator` is invariant.
- **No cross-user personal data leakage.** Cross-case synthesis is
  anonymised at the source (see §6).
- **No auto tribunal filing.** Every tribunal artefact is reviewed
  by the user and a qualified human before submission.
- **No fake health numbers.** If a metric value is unavailable,
  report `NOT_MEASURED`, not zero, not a placeholder, not a guess.

## 3. Live Evolution Cycle 001 — Calibrator Run

Defined as a **future dry-run job**. The first execution is a
calibration exercise; nothing it produces is allowed to mutate
production behaviour.

Procedure:

1. Pull the first 100 entries from `decision_ledger` (read-only).
2. Re-run each against the trusted test-scenario set.
3. Check citation accuracy against the answers the system originally
   produced.
4. Check whether the extractor identifies deadline paradoxes (§4).
5. Check whether the auditor flags notice-period issues.
6. Generate prompt / rule improvement candidates for any
   reproducible defect.
7. Store candidates in `prompt_candidate_registry` (see §9). Each
   candidate carries its source trace ID(s).
8. Require HITL approval before any candidate is promoted to
   the live prompt path.
9. Produce a morning report summarising: number of traces sampled,
   number of defects, number of candidates generated, citation
   failure rate, paradox detections.

Acceptance: the job runs end-to-end against staging without ever
writing to a production prompt store.

## 4. December 9 Paradox Test

Defined as a **test pattern**, not a completed feature.

The test verifies whether the system can detect inconsistent dates
across:
- the user's freeform statement,
- the contract PDF,
- an uploaded image / JPG (OCR'd transcript),
- the employer's letter,
- the timeline extracted by the case-assistant.

Required output shape:

```
{
  "detected_inconsistency": true,
  "confidence_score": 0.0-1.0,
  "required_follow_up_question": "...",
  "blocked_legal_conclusion": true
}
```

Any case in which an inconsistency is detected MUST block a legal
conclusion until a follow-up resolves the discrepancy. The blocked
state is part of the contract, not an error.

## 5. DSPy Optimisation Rules

DSPy *may*:

- analyse failed traces from `decision_ledger`,
- propose better prompts (saved to `prompt_candidate_registry`),
- propose better rule wording (saved as candidates),
- propose new tests for the scenario vault.

DSPy *must not*:

- update production prompts directly,
- change deterministic legal rules directly,
- commit code,
- deploy to Kubernetes,
- bypass the citation verifier,
- bypass HITL approval.

## 6. Cross-Case Synthesis

Implemented only as **anonymised pattern detection**. Required
concepts on every emitted pattern row:

- `employer_hash` (one-way hash; salt rotated quarterly).
- `clause_fingerprint` (deterministic structural fingerprint of the
  clause, not the verbatim text).
- `issue_type`.
- `statutory_reference`.
- `risk_score`.
- `case_count` (lower-bounded; k ≥ 5 to publish).
- `confidence_score`.
- **No personal data in shared pattern.** Pre-emit redaction is
  mandatory.

UX tag convention: emitted patterns carry a label such as
`Systemic Pattern Candidate — Notice Breach`.

The phrase **"High Quantum Potential" is forbidden in production
UX.** Replace with **"Systemic Risk — Review Required"**.

## 7. Agent roadmap additions

Add future agent roles. Each is interface-only at sprint start;
each carries a tight scope:

| Agent | Scope | Restriction |
| --- | --- | --- |
| Negotiation Drafting Agent | Drafts negotiation options based on retrieved sources. | Drafts options only. No outbound communication. No employer-facing send. |
| ET1 Preparation Agent | Maps the user's facts into ET1 fields with citation evidence. | Field-mapping only. **No automatic tribunal filing.** |
| Tribunal Bundle Agent | Compiles a bundle outline (index, page references). | No actual filing; user / legal reviewer signs off. |
| Evidence Gap Agent | Flags facts that lack supporting evidence in the case. | Flag-only; never invents evidence. |
| Remedy Valuation Agent | Computes statutory caps + Vento band placement with citations. | Calculation-only; never promises a settlement figure. |

## 8. Infrastructure design (planning only)

Proposed Kubernetes structure (no manifest applied in Sprint 16):

| Item | Value |
| --- | --- |
| CronJob name | `iterlaw-live-evolution-nightly` |
| Namespace | `iterlaw-monitoring` (default) or `iterlaw-ai` if the existing repo convention requires |
| ConfigMap | `iterlaw-evolution-config` — sample sizes, scenario refs, severity thresholds |
| Secret refs | by name only; no values committed |
| DB role for the job | read-only on `decision_ledger`; write-only on `evolution_*` and `prompt_candidate_registry` |
| Production prompt store | **no write permission for the job ServiceAccount** |

If unsure about the canonical namespace, document the manifest plan
only. **Do not create live manifests** until an operator confirms
the namespace + ServiceAccount RBAC.

## 9. Database planning (proposed future tables)

Each table is **planned**, not yet migrated. Each must carry
`created_at`, `source`, `status`, audit fields, and no raw secret
data.

| Table | Purpose |
| --- | --- |
| `evolution_runs` | One row per nightly job execution. |
| `evolution_trace_results` | Per-trace re-run outcome (citation pass/fail, paradox detected, etc.). |
| `prompt_candidate_registry` | DSPy / human candidates awaiting HITL approval. |
| `synthetic_scenarios` | Generated edge cases. Never imported into trusted legal corpus. |
| `systemic_pattern_candidates` | Anonymised cross-case patterns; emitted only when `case_count ≥ 5`. |
| `hitl_approvals` | Approval / rejection record per candidate, with reviewer ID + reason. |

## 10. Metrics contract

Metric names below are **defined**, not currently populated. If a
metric value is unavailable, the exporter reports `NOT_MEASURED`,
not zero, not a guess.

- `iterlaw_evolution_run_total`
- `iterlaw_evolution_failed_trace_total`
- `iterlaw_prompt_candidate_total`
- `iterlaw_systemic_pattern_candidate_total`
- `iterlaw_citation_failure_rate`
- `iterlaw_latency_ms`
- `iterlaw_wasm_gate_duration_ms`

## 11. Acceptance criteria

Sprint 16 is PASS only if:

- Documentation added (this file).
- Roadmap updated.
- No claim of live deployment unless verified by command output.
- No fake metrics.
- No production mutation path introduced.
- HITL approval model documented.
- Cross-case synthesis anonymisation documented.
- ET1 auto-filing blocked.
- Existing tests still pass if code is touched.
- `rg -i "rightsnow" docs k8s apps` does not introduce new forbidden naming.
- `git diff --stat` and `git status -sb` are reported.

## 12. Out of scope for Sprint 16

- Live Kubernetes deployment.
- Real DSPy execution against production traces.
- Public-UX rollout of cross-case patterns.
- Tribunal filing automation of any kind.
- Synthetic scenarios entering the trusted legal corpus.

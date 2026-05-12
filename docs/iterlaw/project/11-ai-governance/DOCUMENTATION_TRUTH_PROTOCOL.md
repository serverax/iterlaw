# Documentation Truth Protocol

**Status:** Planning and governance specification.
**Author note:** Authored fresh against canonical HEAD `8c2c379`. Not an import of the unrecoverable Docs AIA commit `5cfb0a4`.

---

## Purpose

Define what every IterLaw documentation claim must mean, what evidence backs it, and what cannot be claimed without that evidence. This protocol applies to every doc in `docs/iterlaw/project/`, every QA report in `reports/`, and every AIA hand-off response.

It is the documentation-side counterpart to the CLAUDE.md "STRICT ENGINEERING MODE (HARD)" rules. Where this file is silent and CLAUDE.md is explicit, CLAUDE.md wins.

---

## Status vocabulary

Every claim about a feature, sprint, deployment, or verification uses one of:

| Status | Meaning | Required to claim |
| --- | --- | --- |
| **PASS** | The work is complete; evidence exists in this repo; the named gate ran and returned success. | Command output / test summary / migration log / sign-off report file — all named and reachable from the doc. |
| **PARTIAL** | Some subset of the work passes; the rest is missing, blocked, or out of scope. The doc states **which** subset passes and **which** subset is incomplete. | Evidence for the passing subset; explicit list of the incomplete subset; refusal reason for the incomplete subset. |
| **FAIL** | The work was attempted, the gate ran, the gate returned failure. | Command output / test summary / failure trace; a follow-up plan or escalation. |
| **BLOCKED** | The work cannot proceed under current constraints (e.g. operator action required, repo identity mismatch, locked-decision conflict). | A precise blocker statement: which constraint, which doc, which next operator action would unblock. |
| **NOT EXECUTED** | The command / test / verifier was not run in this turn. | A note explaining why (out of scope, no permission, requires DB / cluster / push). |
| **NOT VERIFIED** | A claim was made without evidence. **Equivalent to UNKNOWN.** Must not be used to support PASS. | An explicit note that the claim requires evidence and is currently unverified. |
| **UNKNOWN** | The state cannot be determined from the available data. | A note explaining what data would be needed. |

These eight states are the only ones permitted to describe work, evidence, or gate outcomes. A doc that says "done", "ready", "deployed", "implemented", or "fixed" **without** mapping to one of these states is a defect.

---

## Evidence requirements per claim type

| Claim | Evidence needed for PASS |
| --- | --- |
| Code change merged | Files-changed list + `npm run typecheck` exit 0 + `npm run build` exit 0 + `npx vitest run` summary (files / tests counts) + static-safety scan summary. |
| Documentation change | Files-changed list + grep scan output for forbidden-naming + grep scan output for unsafe-completion claims. |
| Migration ready | The `.sql` apply log against a non-production DB + the matching `.down.sql` rollback log + a verifier run. |
| Migration applied in **staging** | psql apply log against the confirmed staging DSN + sign-off captured in `reports/ITERLAW_SPRINT_*_STAGING_APPLY_<YYYY-MM-DD>.log` + verifier `summary: PASS`. |
| Migration applied in **production** | All of the above against production + operator authorisation recorded in the same instruction + post-apply verifier `summary: PASS`. |
| Backup uploader works | Image built, digest pinned in the manifest, dry-run apply OK, first restore drill log captured in `reports/`. |
| Cluster manifest landed | `kubectl apply --dry-run=server` output captured in `reports/`. **No real apply by an AIA.** |
| Benchmark claim ("sub-second", "p95 < X ms") | A measured benchmark file under `docs/benchmarks/` with method, hardware, percentiles, and date. |
| Sprint complete | All in-scope tests PASS + verifiers PASS + operator action evidenced + status updated in `07-sprints/SPRINT_INDEX.md` + plan file carrying a "DONE" header. |

A claim missing any of the listed evidence types is **PARTIAL** at best, never PASS.

---

## What does NOT count as verification

- "I ran the command in another session" — chat memory is not evidence.
- "The previous AIA reported PASS" — without the cited report file, it is unverified.
- "The code looks right" — code review is not test execution.
- "It should work" — speculation is not evidence.
- "We have a plan to fix it" — a plan is not a result.
- "It worked locally last week" — undated, undatabased, unrepeatable.
- "TODO: verify" — explicitly unverified.
- A screenshot pasted into chat — outside this repo, not auditable.

Each of the above is **NOT VERIFIED**. A doc that elevates them to PASS is a defect.

---

## Examples of UNSAFE claims (never write these without evidence)

| Unsafe claim | Why unsafe |
| --- | --- |
| "Sprint 10 complete" | Staging DB verification is **PENDING**. The phrase implies all-PASS without evidence. |
| "Production verified" | Production is **BLOCKED**. The phrase implies a gate that has not been run. |
| "Deployed to production" | No agent in this repo has authority to deploy. |
| "All migrations applied" | Without a per-environment apply log + verifier, this is unverified. |
| "Backups tested" | Without a restore-drill log, this is unverified. |
| "Sub-second answer latency" | Without a benchmark file under `docs/benchmarks/`, this is unverified. |
| "External LLM disabled" | Stronger than the evidence. Correct: "External LLM in the answer path is forbidden by the Sprint 11 transport policy (denies provider hostnames) and asserted by static-safety tests." |
| "Citation gate is bulletproof" | No gate is bulletproof; the correct claim is "The citation gate rejects empty, zero-citation, and hallucinated outputs, asserted by the Sprint 11 test set." |
| "We will never call OpenAI" | Future-tense absolute. Correct: "Provider hostnames are denied by `localTransportPolicy.ts` today; any change requires an ADR + operator approval." |

---

## Examples of ACCEPTABLE claims

| Acceptable claim | Why acceptable |
| --- | --- |
| "Sprint 10 repo implementation: **PASS** (typecheck / build / vitest 615 / 51 green; see `reports/ITERLAW_QA_REPORT_SPRINT_10_DB_IMPLEMENTATION.md`)." | Named report + named gates with counts. |
| "Sprint 10 local Docker DB verification: **PASS** (2026-05-12, pgvector/pgvector:pg16 full forward chain applied; see `reports/ITERLAW_SPRINT_10_LOCAL_DOCKER_DB_VERIFY.md`)." | Dated, environment-named, evidence-named. |
| "Sprint 10 real staging DB verification: **PENDING**." | Explicit state with no false claim. |
| "Production: **BLOCKED**." | Explicit state. |
| "Live HTTP transport: **NOT STARTED**." | Explicit state. |
| "Tests must pass without DATABASE_URL." | A safety rule, not a claim of completion. |
| "The Sprint 11 transport policy denies `api.openai.com`, `anthropic.com`, `generativelanguage.googleapis.com`, `api.cohere.ai`, `api.mistral.ai`." | Names the code, lists the deny-set, asserts a static fact. |

---

## Local / staging / production status rules

The three environments are distinct gates. **Each gate has its own evidence requirement.** Crossing between gates without the named evidence is a defect.

### Local

- Allowed claims: typecheck, build, unit tests, static-safety scans, local Docker DB chain application.
- Local PASS does **not** imply staging PASS.
- Local PASS does **not** imply production PASS.

### Staging

- Allowed claims: against a confirmed dev / staging Postgres (not production), with apply logs and verifier output captured in `reports/ITERLAW_SPRINT_*_STAGING_APPLY_<YYYY-MM-DD>.log`.
- Staging PASS does **not** imply production PASS.
- Staging environment must be operator-confirmed non-production. The AKS context observed locally is production-only; AKS staging verification is BLOCKED until a non-production kubeconfig exists.

### Production

- Allowed claims only after **all** of:
  - Staging PASS recorded.
  - Operator promotion authorisation in the same instruction.
  - `kubectl apply --dry-run=server` output for the production target captured.
  - Production verifier `summary: PASS` recorded in `reports/`.
  - Post-apply smoke test recorded.
- An AIA may not write the words "production verified" / "production ready" / "production approved" without all of the above. Until all are recorded, production is **BLOCKED**.

### Sprint 10 closeout rule

**Sprint 10 cannot be marked complete until real staging DB verification PASSES.** This rule overrides any task instruction that asks for Sprint 10 PASS without the evidence above. Local Docker DB verification is **additional but separate** evidence; it does not substitute for staging DB verification.

### Production-ready rule

**Production cannot be marked ready until explicit production gates pass.** The named gates are:

1. Sprint 10 real staging DB verification PASS (with operator sign-off).
2. Backup uploader image built + digest pinned + first restore drill recorded.
3. Storage Box CIDR pinned in the backup network policy.
4. Ingress TLS plan complete.
5. Pod-security baseline asserted by `scripts/qa/verify-iterlaw-v3-safety.sh` PASS.
6. Operator authorisation in the same instruction.

Until **all six** are recorded with named evidence, production status is **BLOCKED**.

---

## Audit hooks

Every doc commit should be accompanied by:

- A grep for `Sprint 10 complete` / `production verified` / `RightsNow` / `rightsnow` / `iterlaw-prod` / `deployed` over the changed paths.
- A classification of every hit as: allowed forbidden-policy text / allowed historical reference / unsafe active usage / unsafe completion claim.
- A refusal to commit if any hit is in the last two classes.

The Docs AIA enforces this on every doc PR. Other AIAs follow the same audit when they touch docs.

---

## Status

- Protocol: **draft / planning**. Not a code change. Not deployed.
- Sprint 10: **PENDING** real staging DB verification.
- Sprint 11: **PLANNED / BLOCKED**.
- Production: **BLOCKED**.

## Related

- [`AIA_OPERATING_MODEL.md`](AIA_OPERATING_MODEL.md)
- [`NAMING_CONSISTENCY_POLICY.md`](NAMING_CONSISTENCY_POLICY.md)
- [`AI_GOVERNANCE_INDEX.md`](AI_GOVERNANCE_INDEX.md)
- [`SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md`](SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md)
- `../08-qa/QA_PROCESS.md`
- `../09-operations/OPERATIONS_RULES.md`
- `../ITERLAW_PROJECT_STATUS.md`
- `../07-sprints/SPRINT_INDEX.md`

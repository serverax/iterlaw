# AI Governance Index

**Status:** Planning and governance index.
**Author note:** Authored fresh against canonical HEAD `8c2c379`. Not an import of the unrecoverable Docs AIA commit `5cfb0a4`.

Single entry point into IterLaw's AI governance documents. AIAs read this first; operators come here to see what governance exists.

---

## Read order

Read these in order before acting on any AI governance task:

1. **[`../ITERLAW_PROJECT_STATUS.md`](../ITERLAW_PROJECT_STATUS.md)** — current sprint state + blockers + locked decisions snapshot.
2. **[`../00-index/AI_TOOL_START_HERE.md`](../00-index/AI_TOOL_START_HERE.md)** — locked decisions you may not re-litigate.
3. **[`../00-index/CANONICAL_NAMES.md`](../00-index/CANONICAL_NAMES.md)** — IterLaw / OrdinoxAI / no-RightsNow + canonical namespaces.
4. **[`NAMING_CONSISTENCY_POLICY.md`](NAMING_CONSISTENCY_POLICY.md)** — naming policy + audit commands.
5. **[`DOCUMENTATION_TRUTH_PROTOCOL.md`](DOCUMENTATION_TRUTH_PROTOCOL.md)** — what PASS / PARTIAL / FAIL / BLOCKED mean + evidence requirements.
6. **[`AIA_OPERATING_MODEL.md`](AIA_OPERATING_MODEL.md)** — who the AIAs are, what they can / cannot do, hand-off contract, veto rights.
7. **[`SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md`](SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md)** — the AI architecture contract: legal request pipeline, RAG, model routing, transport policy, audit, human approval.
8. **[`../10-decisions/`](../10-decisions/)** — ADRs (currently: offline-first legal DB model).
9. **[`../09-operations/OPERATIONS_RULES.md`](../09-operations/OPERATIONS_RULES.md)** — push / deploy / kubectl / secrets standing rules.

---

## Governance documents in this folder

| File | Owner | Purpose |
| --- | --- | --- |
| [`AIA_OPERATING_MODEL.md`](AIA_OPERATING_MODEL.md) | Docs AIA | How AIAs operate: named roles, authority, veto rights, hand-off, coordination rules. |
| [`DOCUMENTATION_TRUTH_PROTOCOL.md`](DOCUMENTATION_TRUTH_PROTOCOL.md) | Docs AIA | What PASS / PARTIAL / FAIL / BLOCKED mean. Evidence required for each. What does not count as verification. Sprint 10 / production rules. |
| [`NAMING_CONSISTENCY_POLICY.md`](NAMING_CONSISTENCY_POLICY.md) | Docs AIA | IterLaw / OrdinoxAI / no-RightsNow + canonical namespaces + forbidden names + audit commands. |
| [`SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md`](SUPERIOR_AI_ARCHITECT_AIA_SPECIFICATION.md) | Superior AI Architect AIA | The full AI architecture contract: legal request pipeline (16 steps), RAG, model routing, transport policy, prompt governance, evaluation, audit, human approval, separation of concerns. |
| `AI_GOVERNANCE_INDEX.md` *(this file)* | Docs AIA | Index + read order + quick command checklist. |

The `11-ai-governance/` directory is the canonical home for these documents.

---

## Related governance surfaces outside this folder

- [`../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`](../10-decisions/ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md) — the offline-first legal DB model decision record.
- [`../01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md`](../01-architecture/OFFLINE_FIRST_LEGAL_DB_ARCHITECTURE.md) — the architecture contract.
- [`../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md`](../03-rag/MULTI_TIER_RETRIEVAL_ARCHITECTURE.md) — the Tier 0–5 retrieval flow.
- [`../01-architecture/SUPREME_CONTROLLER_ARCHITECTURE.md`](../01-architecture/SUPREME_CONTROLLER_ARCHITECTURE.md) — agent registry + human approval triggers.
- [`../01-architecture/WASM_INTELLIGENCE_ARCHITECTURE.md`](../01-architecture/WASM_INTELLIGENCE_ARCHITECTURE.md) — WASM as control plane.
- [`../07-sprints/SPRINT_INDEX.md`](../07-sprints/SPRINT_INDEX.md) — sprint table + counts.
- [`../07-sprints/SPRINT_11_LOCAL_LLM_GATEWAY_AND_TRANSPORT_POLICY.md`](../07-sprints/SPRINT_11_LOCAL_LLM_GATEWAY_AND_TRANSPORT_POLICY.md) — Sprint 11 plan.
- [`../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md`](../09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md) — Sprint 10 closeout procedure.

---

## Current status

- **Sprint 10:** real staging DB verification **PENDING** (operator action). Repo + local Docker DB verification: PASS.
- **Sprint 11:** **PLANNED / BLOCKED** by Sprint 10 closeout. Mock-safe Phase 1 + Phase 2A already landed (commits `b896764`, `b14fd2d`); live HTTP transport + pipeline wiring: **NOT STARTED**.
- **Production:** **BLOCKED**.
- **Offline-first legal DB model:** **ACCEPTED** (ADR `ADR_OFFLINE_FIRST_LEGAL_DB_MODEL.md`).
- **External LLM in the answer path:** **FORBIDDEN** at runtime by Sprint 11 transport policy.
- **Canonical Kubernetes namespaces:** `iterlaw-ai`, `iterlaw-rag`, `iterlaw-api`, `iterlaw-monitoring`, `iterlaw-security`.

---

## Quick command checklist for governance scans

Run these from the repo root before any governance commit:

```text
# Forbidden product-name regression
grep -R -n "RightsNow" docs/iterlaw/project reports || true
grep -R -n "rightsnow" docs/iterlaw/project reports || true

# Forbidden namespace regression
grep -R -n "iterlaw-prod" docs/iterlaw/project reports || true

# Unsafe completion / deployment claims
grep -R -n "Sprint 10 complete" docs/iterlaw/project reports || true
grep -R -n -i "production verified" docs/iterlaw/project reports || true
grep -R -n -i "production approved" docs/iterlaw/project reports || true
grep -R -n -i "ready for production" docs/iterlaw/project reports || true
grep -R -n -i "staging.*PASS" docs/iterlaw/project reports || true
grep -R -n -i "deployed" docs/iterlaw/project reports || true

# Diff + repo state
git status -sb
git diff --stat
git log --oneline --decorate -5

# Repo-level enforcement (must be run when changing names or active code)
bash scripts/qa/verify-iterlaw-v3-safety.sh
bash scripts/infra/verify-iterlaw-repo.sh
bash scripts/infra/verify-iterlaw-canonical-namespaces.sh
```

Every hit in the first three groups must be classified as: **allowed forbidden-policy text** / **allowed historical reference** / **allowed conditional gate** / **unsafe active usage** / **unsafe completion claim**. Hits in the last two classes must be fixed before commit.

---

## How AIAs are added or retired

| Action | Procedure |
| --- | --- |
| Add a new AIA | Operator decision. New spec doc in this folder, entry in this index, new row in `AIA_OPERATING_MODEL.md`. An ADR in `../10-decisions/` if authority boundaries change. |
| Retire an AIA | Operator decision. Mark the row in this index + `AIA_OPERATING_MODEL.md` as `retired` with a date. Do not delete the spec file — keep it as historical reference. |
| Rename an AIA | ADR required. The Docs AIA updates this index and `AIA_OPERATING_MODEL.md`. |

---

## Truth statement

> No source code changed by this index.
> No migrations changed.
> No tests changed.
> No Kubernetes manifests changed.
> No push performed.
> No deployment performed.
> No kubectl mutating command performed.
> No production DB touched.
> No external LLM call performed.
> No secret values printed.
> Sprint 10 real staging DB verification: **PENDING**.
> Production: **BLOCKED**.

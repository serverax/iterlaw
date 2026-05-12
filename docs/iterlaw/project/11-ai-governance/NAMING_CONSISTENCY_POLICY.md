# Naming Consistency Policy

**Status:** Planning and governance specification.
**Author note:** Authored fresh against canonical HEAD `8c2c379`. Not an import of the unrecoverable Docs AIA commit `5cfb0a4`.

---

## Purpose

Lock the names IterLaw uses in active code, configs, manifests, READMEs, and project docs. Earlier renames have produced drift; this policy is the single source of truth.

Authoritative quick-reference list also lives at [`../00-index/CANONICAL_NAMES.md`](../00-index/CANONICAL_NAMES.md). Where the two disagree, the operator decides which to update — they must remain consistent.

---

## Active product / platform names

| Name | Meaning | Where used |
| --- | --- | --- |
| **IterLaw** | The active legal AI product. First beta: UK Employment Law. | Runtime UI, config, package names (`@iterlaw/*`), READMEs, project docs, repo name. |
| **OrdinoxAI** | The wider AI management platform / company brain that hosts IterLaw and related products. | AIA governance specifications, platform-level architecture references. |

Use **IterLaw** for the product. Use **OrdinoxAI** for the wider platform brand. Do not introduce other product / platform names without an ADR.

---

## Forbidden as active names

| Name | Status | Where allowed (legacy only) |
| --- | --- | --- |
| **RightsNow** | **Forbidden** as an active product name. Legacy. | `docs/CRUSER_*`, `.github/workflows-disabled/`, `k8s/iterlaw-disabled-*`, sprint changelog text (e.g. "Sprint 9: rename RightsNow → IterLaw"), policy / verifier files that list `rightsnow` as a forbidden token, files carrying an explicit `Legacy name: RightsNow` marker. |
| **rightsnow** (lowercase) | **Forbidden** as an active package name. Legacy. | Same as above. Package scopes renamed to `@iterlaw/*` in Sprint 9. |
| **rightsnow-ai**, **rightsnow-*** | **Forbidden** as namespace, package, image, or domain. | Not allowed anywhere active. Allowed only inside legacy markers and verifier deny-lists. |

Re-introducing any of the above to active code, config, or docs is a defect and is blocked by `scripts/qa/verify-iterlaw-v3-safety.sh` and `scripts/infra/verify-iterlaw-repo.sh`.

---

## Canonical Kubernetes namespaces

Only these five active namespaces:

- `iterlaw-ai` — AI / orchestrator / user-facing AI workloads.
- `iterlaw-rag` — RAG ingestion, retrieval, graph, reranking, source processing.
- `iterlaw-api` — API gateway / backend APIs.
- `iterlaw-monitoring` — metrics, logs, dashboards, alerts.
- `iterlaw-security` — security scanners, policy controllers, secret controllers.

Legacy `iterlaw-data` may remain in the data plane until safely retired.

### Forbidden namespaces

| Namespace | Reason |
| --- | --- |
| `iterlaw-prod` | **Do not create or reference.** Production-vs-non-production is signalled by **cluster context**, not by namespace name. |
| Bare `iterlaw` | **Do not create.** Disabled standalone manifests live under `k8s/iterlaw-disabled-master-order/` and `k8s/iterlaw-disabled-standalone-legal-orchestrator/`. |
| `rightsnow*` | Forbidden alongside the product-name rule above. |

`iterlaw-prod` and bare `iterlaw` are checked by `scripts/infra/verify-iterlaw-canonical-namespaces.sh`.

---

## Allowed legacy / historical references

Legacy names are acceptable **only** when one of the following applies:

1. The file is under a clearly legacy path: `docs/CRUSER_*`, `.github/workflows-disabled/`, `k8s/iterlaw-disabled-*`.
2. The text is inside a **forbidden-name policy statement** (`"Do not use RightsNow"`, `"Forbidden: rightsnow*"`, `"Re-introducing RightsNow is forbidden"`).
3. The text is a **deny-list / verifier deny-list entry** (e.g. inside `scripts/infra/verify-*.sh`).
4. The file carries an explicit `Legacy name: RightsNow` marker.
5. The text is a **historical sprint changelog** ("Sprint 9: rename RightsNow → IterLaw").

Every other appearance is treated as a defect and must be either:

- Rewritten to **IterLaw / OrdinoxAI**, or
- Removed, or
- Labelled clearly as legacy with one of the markers above.

---

## Naming-consistency audit commands

Run these before every doc commit that touches names:

```text
# Forbidden product-name regression
grep -R -n "RightsNow" docs/iterlaw/project reports || true
grep -R -n "rightsnow" docs/iterlaw/project reports || true

# Forbidden namespace regression
grep -R -n "iterlaw-prod" docs/iterlaw/project reports || true
grep -R -n -E "namespace:[[:space:]]+iterlaw([[:space:]]|$)" docs/iterlaw/project reports k8s || true

# Unsafe completion claims
grep -R -n "Sprint 10 complete" docs/iterlaw/project reports || true
grep -R -n -i "production verified" docs/iterlaw/project reports || true
grep -R -n -i "production approved" docs/iterlaw/project reports || true
grep -R -n -i "ready for production" docs/iterlaw/project reports || true
grep -R -n -i "staging.*PASS" docs/iterlaw/project reports || true
grep -R -n -i "deployed" docs/iterlaw/project reports || true
```

Classify every hit. Acceptable classifications:

- **allowed forbidden-policy text** — the text is a "Do not use X" / "Forbidden: X" statement.
- **allowed historical / deprecated reference** — file is under a legacy path or carries an explicit legacy marker, or a dated sprint changelog.
- **allowed conditional / forward-looking gate** — text states a future condition (e.g. "BLOCKED until ... PASS"), not a current claim.
- **unsafe active usage** — must be fixed before commit.
- **unsafe completion claim** — must be fixed before commit.

Repository-level enforcement:

```text
bash scripts/qa/verify-iterlaw-v3-safety.sh
bash scripts/infra/verify-iterlaw-repo.sh
bash scripts/infra/verify-iterlaw-canonical-namespaces.sh
```

Run these before any push.

---

## Edge cases (resolved)

| Case | Resolution |
| --- | --- |
| Kubernetes manifest references a legacy `ordinox-ai` namespace for cross-namespace DNS | Allowed as a manifest fact in `06-infra/INFRA_SUMMARY.md`, framed as "legacy namespace name pending a separately tracked rename". Docs do not endorse the legacy name; they reflect manifest reality without renaming the manifest. |
| Sprint changelog mentions "RightsNow → IterLaw" rename | Allowed as historical sprint description. |
| Verifier script contains `rightsnow` in a deny-list array | Allowed as a deny-list literal. |
| `package.json` history shows `@rightsnow/*` scopes | Forbidden in **current** `package.json`; rename to `@iterlaw/*` was completed in Sprint 9. Historical commit history is OK. |
| New AIA spec needs to reference OrdinoxAI | Allowed and required — AIAs are part of OrdinoxAI. |

---

## When this policy is unclear

Escalate to the operator. Do not silently invent a name, namespace, or rename rule. New names require an ADR in `../10-decisions/`.

---

## Status

- Policy: **draft / planning**. Not a code change. Not deployed.
- Sprint 10: **PENDING** real staging DB verification.
- Sprint 11: **PLANNED / BLOCKED**.
- Production: **BLOCKED**.

## Related

- [`../00-index/CANONICAL_NAMES.md`](../00-index/CANONICAL_NAMES.md)
- [`../00-index/AI_TOOL_START_HERE.md`](../00-index/AI_TOOL_START_HERE.md)
- [`AIA_OPERATING_MODEL.md`](AIA_OPERATING_MODEL.md)
- [`DOCUMENTATION_TRUTH_PROTOCOL.md`](DOCUMENTATION_TRUTH_PROTOCOL.md)
- [`AI_GOVERNANCE_INDEX.md`](AI_GOVERNANCE_INDEX.md)
- `../09-operations/OPERATIONS_RULES.md`

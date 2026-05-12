# Naming Consistency Policy

**Status:** Active governance specification.
**Last Updated:** May 2026

---

## Purpose

Consistent naming prevents confusion, enables tool automation, and makes handoffs between AIAs clear. Every file, folder, namespace, and reference must follow this policy.

---

## 1. Product Names

### Active Product Name

**IterLaw** — The UK employment law AI assistant.

Use in:
- Documentation (all)
- User-facing messaging
- Commit messages
- Comments
- Handoff documents
- Sprint plans

Example:
```
IterLaw helps UK workers understand their employment rights during disputes.
```

### Wider Platform

**OrdinoxAI** — The AIA management platform and company brain.

Use in:
- Platform-level architecture docs
- Company strategy
- Multi-product coordination
- Infrastructure shared by multiple products

Example:
```
OrdinoxAI coordinates IterLaw, housing rights assistant, and future legal products.
```

### Deprecated Names (Never Use in Active Docs)

- ~~RightsNow~~ — old codename, deprecated March 2026
- ~~rightsnow~~ — old namespace, deprecated
- ~~iterlaw-prod~~ — forbidden, use canonical namespaces instead

**Rule:** Do not use RightsNow or rightsnow in any active documentation. Legacy references only when documenting migration history.

Example of allowed legacy reference:
```
## Historical Note
RightsNow was the original codename (2026-Q1). Product renamed to IterLaw in May 2026
when operational scope expanded to include housing, benefits, and consumer rights assistants.
```

---

## 2. Kubernetes Namespaces

### Canonical Namespaces

Always use these exact names:

```
iterlaw-ai              # AI services (LLM, RAG, embeddings)
iterlaw-rag             # RAG orchestration and vector DB
iterlaw-api             # REST API and web service layer
iterlaw-monitoring      # Observability (Prometheus, Loki, Grafana)
iterlaw-security        # Security services (secrets, RBAC, audit)
```

### Forbidden Namespace Names

❌ `iterlaw-prod` — promotes false impression of production readiness
❌ `production` — too generic
❌ `rightsnow` — deprecated codename
❌ `rightsnow-*` — all variants forbidden

### Namespace Usage

- **Development:** `iterlaw-ai` (single dev namespace, not per-dev)
- **Staging:** Use same `iterlaw-*` namespaces with `-staging` suffix in ConfigMaps only
- **Production:** Same namespaces; operator controls via RBAC and NetworkPolicy

Example:
```yaml
# Staging: same namespace structure, different ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: iterlaw-config-staging
  namespace: iterlaw-ai
data:
  environment: staging
  api_endpoint: https://staging-api.iterlaw.local
```

---

## 3. Git Repositories

### Repository Name

```
iterlaw
```

Not:
- ❌ `rightsnow`
- ❌ `iterlaw-prod`
- ❌ `iterlaw-uat`

### Git Branch Names

**Main development branch:** `main` or `develop` (team choice)

**Feature branches:**
```
feature/aia-governance-docs
feature/staging-db-verify
feature/graphrag-schema
```

**Hotfix branches:**
```
hotfix/citation-gate-bug
hotfix/secret-rotation
```

**Never:**
- ❌ `rightsnow-*`
- ❌ `prod-*` (misleading; use main branch + tags)
- ❌ Branch names with secrets or sensitive info

### Git Tags

Use semantic versioning:
```
v0.9.0-sprints-1-9      # Sprints 1–9 complete
v0.10.0-sprint-10-pass  # Sprint 10 complete
v1.0.0-launch           # Production launch
```

Never:
- ❌ `rightsnow-*`
- ❌ `production-ready` (too vague)
- ❌ Tag with secrets

---

## 4. File and Folder Structure

### Top-level Folders

```
/mnt/project/
  ├─ docs/
  │  └─ iterlaw/
  │     ├─ project/
  │     │  ├─ 07-sprints/
  │     │  ├─ 11-ai-governance/
  │     │  ├─ ITERLAW_PROJECT_STATUS.md
  │     │  └─ ...
  │     └─ architecture/
  ├─ src/
  │  ├─ iterlaw-ai/
  │  ├─ iterlaw-rag/
  │  ├─ iterlaw-api/
  │  └─ ...
  ├─ k8s/
  │  ├─ iterlaw-ai/
  │  ├─ iterlaw-rag/
  │  ├─ iterlaw-api/
  │  └─ iterlaw-monitoring/
  ├─ reports/
  │  └─ ITERLAW_*.md
  └─ tests/
```

### File Naming

**Documents:**
```
ITERLAW_PROJECT_STATUS.md          ✅
IterLaw_Project_Status.md           ❌ (use ITERLAW_PROJECT_STATUS.md)
SPRINT_10_SUMMARY.md               ✅
SPRINT_10_qa_report.md             ❌ (use SPRINT_10_QA_REPORT.md for consistency)
```

**Source code:**
```
iterlaw-ai/src/rag-engine.ts       ✅
iterlaw-rag/src/embedding-service.ts ✅
iterlaw_api_handler.ts             ❌ (use iterlaw-api/src/handler.ts)
```

**Kubernetes manifests:**
```
k8s/iterlaw-ai/deployment.yaml     ✅
k8s/iterlaw-rag/postgre.yaml       ❌ (use k8s/iterlaw-rag/postgres.yaml)
k8s/rightsnow-api.yaml             ❌ (use k8s/iterlaw-api/api-service.yaml)
```

---

## 5. Configuration Variables

### Environment Variables

```
ITERLAW_API_ENDPOINT=https://api.iterlaw.local
ITERLAW_RAG_POSTGRES_HOST=postgres.iterlaw-rag
ITERLAW_MONITORING_LOKI_URL=http://loki.iterlaw-monitoring

# Not:
RIGHTSNOW_API_ENDPOINT=...         ❌
ITERLAW_PROD_API_ENDPOINT=...      ❌ (environment is dev/staging/prod, not part of var name)
```

### ConfigMap/Secret Names

```
iterlaw-config                     ✅ (in namespace iterlaw-ai)
iterlaw-secrets                    ✅ (in namespace iterlaw-security)
rightsnow-config                   ❌
iterlaw-prod-secrets               ❌
```

---

## 6. Documentation Naming

### Status Documents

```
docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md
docs/iterlaw/project/07-sprints/SPRINT_INDEX.md
docs/iterlaw/project/07-sprints/SPRINT_10_SUMMARY.md
docs/iterlaw/project/11-ai-governance/AIA_OPERATING_MODEL.md
```

### Reports

```
reports/ITERLAW_DOCS_AIA_GOVERNANCE_UPDATE_REPORT.md
reports/SPRINT_10_QA_REPORT.md
reports/SECURITY_AUDIT_2026_05.md
```

### Architecture Decisions (ADRs)

```
docs/iterlaw/architecture/ADR_0001_raag_not_finetuning.md
docs/iterlaw/architecture/ADR_0002_local_llm_first.md
docs/iterlaw/architecture/ADR_0003_deterministic_gates.md
```

### Runbooks

```
docs/iterlaw/operations/DEPLOYMENT_RUNBOOK.md
docs/iterlaw/operations/INCIDENT_RESPONSE_PLAYBOOK.md
docs/iterlaw/operations/BACKUP_AND_RESTORE.md
```

---

## 7. Naming Changes Require ADR

If any of these need to change:

- Product name (IterLaw → something else)
- Namespace names (iterlaw-ai → different)
- Repository name (iterlaw → different)
- Config variable prefixes (ITERLAW_ → different)

**Required:**
1. Write an ADR explaining why
2. Get all AIAs to review and sign off
3. Plan migration for all existing uses
4. Commit ADR to git before making change
5. Update all docs and examples

Example ADR template:
```
# ADR-0004: [Proposed naming change]

## Status
PROPOSED

## Context
[Why change is needed]

## Decision
[Exact change: old name → new name, all affected areas]

## Consequences
[What breaks, what needs updating, timeline]

## Sign-off Required
- Docs AIA: ___
- Infra AIA: ___
- Security AIA: ___
- All others: ___
```

---

## 8. Consistency Audit Checklist

Before every sprint or major release, run:

```bash
# Search for deprecated names
grep -r "rightsnow" docs/ src/ k8s/ --exclude-dir=.git
grep -r "iterlaw-prod" docs/ src/ k8s/ --exclude-dir=.git
grep -r "RightsNow" docs/ src/ k8s/ --exclude-dir=.git

# Should return nothing. If found, fix before merging.
```

Document results in ITERLAW_PROJECT_STATUS.md as "Naming consistency check: PASS".

---

## 9. Handoff Format: Naming

When handing off between AIAs, state:

```
## Naming Verification

- Product name used: IterLaw ✅
- No deprecated names found: ✅
- Namespaces canonical: ✅ (iterlaw-ai, iterlaw-rag, iterlaw-api, iterlaw-monitoring, iterlaw-security)
- File names consistent: ✅
- Env vars use ITERLAW_ prefix: ✅
- Config names lowercase: ✅

Naming check: PASS
```

---

## 10. Legacy References (Allowed in Specific Contexts)

You may reference old names **only** when documenting history:

```markdown
## Historical Context

The product was originally codenamed RightsNow (2026-Q1) and deployed under that name.
In May 2026, the scope expanded beyond employment law to include housing, benefits, and 
consumer rights. The product was renamed to IterLaw and infrastructure migrated to 
canonical namespaces (iterlaw-ai, iterlaw-rag, etc.).

All references to rightsnow, iterlaw-prod, and RightsNow in operational docs are outdated.
Use IterLaw and canonical namespace names in all current work.
```

Never use deprecated names in:
- ❌ Active source code
- ❌ Active Kubernetes manifests
- ❌ Active environment variables
- ❌ Active sprint plans
- ❌ Current handoffs

---

## 11. Naming Violations & Resolution

**If a violation is discovered:**

1. **Immediately:** Document it in ITERLAW_PROJECT_STATUS.md under "Naming Debt"
2. **Timeline:** Fix within same sprint or next sprint
3. **Fix:** Rename file/variable/config, update all references
4. **Verification:** Run grep audit (section 8), confirm clean
5. **Document:** Add ADR explaining how violation was introduced and how fix prevents recurrence

**Example:**
```
## Naming Debt

### Found: rightsnow-k3s-manifests.yaml
- Status: PENDING FIX
- Fix: Rename to iterlaw-k3s-manifests.yaml
- Scope: update references in docs/, CI/CD, operator runbooks
- Sprint: fix target Sprint 11
```

---

## 12. Onboarding New AIAs

Every new AIA receives this policy as part of onboarding. Confirm understanding with checklist:

```
New AIA Onboarding Checklist

[ ] Read Naming Consistency Policy
[ ] Product name is IterLaw
[ ] Wider platform is OrdinoxAI
[ ] Never use RightsNow or rightsnow
[ ] Canonical namespaces are iterlaw-{ai,rag,api,monitoring,security}
[ ] Never use iterlaw-prod
[ ] File names follow UPPERCASE_WITH_UNDERSCORES
[ ] Env vars use ITERLAW_ prefix
[ ] Violations are documented in PROJECT_STATUS.md
[ ] Naming changes require ADR and all-AIA approval

Confirmed: [Date] [AIA Name]
```

---

*Naming Consistency Policy — May 2026 — IterLaw Docs AIA Governance*

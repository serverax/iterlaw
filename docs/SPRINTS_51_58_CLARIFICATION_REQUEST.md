# Sprints 51–58 — Clarification request (outbound)

**Send to:** Product owner, Infrastructure/DevOps, Legal SME  
**Response SLA:** 24 hours  
**Record answers in:** `docs/SPRINTS_51_58_CLARIFICATIONS.md`  
**Last updated:** 2026-05-16

---

## Copy-paste message (Slack / email)

```text
Subject: [Action required — 24h] IterLaw Sprints 51–58 — 4 implementation clarifications

We are gated on UAT for Sprint 51 code, but need four decisions/values now so staging and schema are ready on day one.

Please reply in-thread or edit docs/SPRINTS_51_58_CLARIFICATIONS.md (PR welcome).

1) PRODUCT — Case linkage (~10 min)
   For document_uploads: which model?
   A) workspace_id only; case_id optional until classification (Sprint 54)
   B) case_id required on every upload
   C) both workspace_id and case_id required on upload
   Your choice: A / B / C

2) INFRASTRUCTURE — Azure Document Intelligence (~5 min)
   Confirm exact staging env var NAMES (and API version + model id):
   - Endpoint variable name + value (redact host if needed)
   - Key variable name (do not paste secret in chat — confirm name only, or use 1Password)
   - API version (e.g. 2024-11-29-preview)
   - Model id (prebuilt-document vs prebuilt-layout)

   Note: prep code uses AZURE_DOCUMENT_INTELLIGENCE_* — say if staging uses AZURE_DOC_INTEL_* instead.

3) INFRASTRUCTURE — Azure OpenAI embeddings (~5 min)
   - Resource endpoint
   - API version
   - Deployment NAME for text-embedding-3-small (not just model family)
   - Confirm dimensions = 1536

4) LEGAL — Sample documents for Sprint 53 E2E (~15 min)
   - Path to sanitized employment letters (if they exist), OR
   - Approve synthetic generation in repo: apps/legal-orchestrator/src/tests/fixtures/documents/
   - Minimum set: dismissal, disciplinary, redundancy, multi-page, low-quality scan (5 files)

Target: all four answered within 24 hours.

Thanks,
[Your name]
```

---

## Routing

| # | Question | Primary owner | Backup |
|---|----------|---------------|--------|
| 1 | Case linkage | Product owner | Engineering |
| 2 | Azure DI env vars | DevOps / Platform | Engineering |
| 3 | Azure OpenAI embedding deployment | DevOps / Platform | Engineering |
| 4 | Sample documents | Legal SME | Product |

---

## After responses

1. Engineering fills `docs/SPRINTS_51_58_CLARIFICATIONS.md` §1–§4.  
2. Update `infrastructure/STAGING_ENV_CHECKLIST.md` status columns.  
3. Commit to `master`: `docs: record clarifications for Sprints 51-58 implementation`.  
4. Readiness grep:

```bash
grep -E "^\*\*Answer:\*\*|^\*\*Status:\*\* RESOLVED" docs/SPRINTS_51_58_CLARIFICATIONS.md
```

5. Await UAT sign-off, then signal: **start sprint 51**.

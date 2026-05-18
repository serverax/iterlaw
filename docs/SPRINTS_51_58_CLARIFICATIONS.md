# Sprints 51–58 — Clarifications (single source of truth)

**Status:** SPRINT 51 RESOLVED — Sprints 52–58 items partially open  
**Owner:** Product + Engineering  
**Last updated:** 2026-05-17  
**Related:** `reports/ITERLAW_SPRINT_51_DOCUMENT_UPLOAD_OCR.md`, `feature/sprint-51-doc-upload`

**UAT sign-off:** Engineering sequencing decision — START ENGINEERING SPRINT 51 (2026-05-17). Product foundation-first order approved.

**Sprint 51 start authorized:** 2026-05-17 · Branch `feature/sprint-51-doc-upload`

---

## 1. Case linkage (`case_id` + `workspace_id` vs workspace-only)

| Field | Value |
|-------|--------|
| **Question** | Should `document_uploads` require both `workspace_id` (from migration 117) and `case_id` (from migration 147), or is workspace-only linkage sufficient for MVP? |
| **Options** | **A)** `workspace_id` only — documents attach to workspace; case link optional via `document_metadata.linked_case_id`. **B)** Required `case_id` on every upload — upload API rejects without active case. **C)** Dual required — both workspace membership and case must match RLS. |
| **Recommendation (engineering)** | **A** for prep; enforce case link at classification time (Sprint 54) unless product requires upload-to-case only. |
| **Blocking** | Yes (Sprint 51) |
| **Status** | **RESOLVED** |
| **Decision** | **A** |
| **Answer** | `workspace_id` required on upload (migration 117); `case_id` **optional** on `POST /api/documents/upload` (Sprint 54 may require link for classification). |
| **Recorded by** | Engineering (sequencing decision) |
| **Date** | 2026-05-17 |
| **Implements in** | Migration 147, `POST /api/documents/upload`, RLS policies |

**Notes**

- Repo today: `117_sprints_52_57_document_intel.sql` → `document_uploads.workspace_id` + `uploaded_by`.
- Prep migration 147 adds optional `case_id` → `legal_case_records(id)`.
- RLS model: `docs/iterlaw/project/05-security/RLS_SECURITY_MODEL.md`.

---

## 2. Azure Document Intelligence

| Field | Value |
|-------|--------|
| **Question** | Confirm env var names, API version, region, and model IDs for OCR. |
| **Blocking** | Yes (Sprint 51) |
| **Status** | **RESOLVED** (canonical names; staging values TBD in vault) |
| **Answer** | Use `AZURE_DOCUMENT_INTELLIGENCE_*` (not `AZURE_DOC_INTEL_*`). REST client in `azureDocumentIntelligenceZone2.ts`; stub when env unset. |
| **Recorded by** | Engineering |
| **Date** | 2026-05-17 |

### Environment variables (canonical)

| Variable | Purpose | Secret? | Status |
|----------|---------|---------|--------|
| `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` | Regional DI base URL | No | NAME LOCKED — value in staging vault |
| `AZURE_DOCUMENT_INTELLIGENCE_KEY` | API key | Yes | NAME LOCKED — value in staging vault |
| `AZURE_DOCUMENT_INTELLIGENCE_API_VERSION` | REST API version | No | Default `2024-11-30` |
| `AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID` | Model | No | Default `prebuilt-document` |

### Operational parameters (Sprint 51)

| Parameter | Confirmed value |
|-----------|-----------------|
| Max upload size | 10 MB |
| OCR confidence manual-review threshold | 0.7 |
| OCR sync timeout → `pending_async` | 30 s |
| Allowed MIME types | PDF, DOCX, plain text (`documentUploadMimeAllowed`) |

---

## 3. Azure OpenAI — embeddings deployment

| Field | Value |
|-------|--------|
| **Question** | What is the exact Azure OpenAI **deployment name** for embeddings (not just model family)? |
| **Blocking** | Sprint 55+ only |
| **Status** | OPEN (not blocking Sprint 51) |
| **Answer** | _Pending DevOps — deployment name for `text-embedding-3-small`, 1536 dims_ |
| **Recorded by** | _TBD_ |
| **Date** | _TBD_ |

### Environment variables (fill when known)

| Variable | Purpose | Example / placeholder | Secret? | Status |
|----------|---------|----------------------|---------|--------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI resource URL | `https://<resource>.openai.azure.com` | No | MISSING |
| `AZURE_OPENAI_API_KEY` | API key | _(from Azure portal)_ | Yes | MISSING |
| `AZURE_OPENAI_API_VERSION` | API version | e.g. `2024-10-21` | No | MISSING |
| `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` | **Deployment name** in Azure | _TBD — e.g. `text-embedding-3-small-prod`_ | No | MISSING |
| `AZURE_OPENAI_EMBEDDING_MODEL` | Model identifier (audit) | `text-embedding-3-small` | No | MISSING |
| `AZURE_OPENAI_EMBEDDING_DIMENSIONS` | Vector size | `1536` | No | MISSING |

**Notes**

- Migration 151 uses `vector(1536)` — deployment must match dimensions.
- `legal-orchestrator` synthesis credentials policy: see `docs/infra/ITERLAW_SECRETS_RUNBOOK.md` (orchestrator may delegate embeddings to worker).

---

## 4. Sample documents (path + generation plan)

| Field | Value |
|-------|--------|
| **Question** | Where do sanitized employment letters live for Sprint 53 E2E and who generates them? |
| **Blocking** | Sprint 53 E2E only |
| **Status** | **RESOLVED** (path; fixtures in Sprint 53) |
| **Answer** | Synthetic fixtures under `apps/legal-orchestrator/src/tests/fixtures/documents/` (G1). |
| **Recorded by** | Engineering |
| **Date** | 2026-05-17 |

### Proposed layout (adjust when confirmed)

| Path | Contents | PII |
|------|----------|-----|
| `apps/legal-orchestrator/src/tests/fixtures/documents/` | Synthetic PDF/DOCX/TXT for CI | None — synthetic only |
| `resources/document-intel/samples/` | Optional operator-provided redacted real letters | Must be redacted + licensed for test use |

### Generation plan options

| Option | Description | Owner |
|--------|-------------|-------|
| **G1** | Hand-authored synthetic letters (dismissal, disciplinary, redundancy) in repo | Engineering |
| **G2** | Solicitor-provided redacted templates (stored outside repo, path in env) | Legal SME |
| **G3** | Azure DI output from public-domain ACAS exemplars (with citation) | Legal SME + Engineering |

### Minimum sample set (for sign-off)

| # | Document type | Format | Used in sprint |
|---|---------------|--------|----------------|
| 1 | Dismissal letter | PDF | 51, 53, 58 |
| 2 | Disciplinary notice | PDF | 52, 53 |
| 3 | Redundancy consultation letter | PDF | 53, 54 |
| 4 | Multi-page contract excerpt | PDF | 55 (chunking) |
| 5 | Low-quality scan (OCR stress) | PDF | 51 |

---

## 5. API surface (confirm before Sprint 51)

| Endpoint | Method | Confirmed? |
|----------|--------|------------|
| `/api/documents/upload` | POST multipart | **YES** (Sprint 51) |
| `GET /api/documents/:id` | GET metadata | **YES** (Sprint 51) |
| `/api/documents/:id/analyze` | POST | Sprint 52+ |
| `/api/documents/:id/chunks` | GET | _TBD_ |
| `/api/documents/:id/search` | POST | _TBD_ |
| `/api/documents/:id/answer` | GET or POST | _TBD_ |

---

## 6. Sign-off checklist

| # | Item | Status |
|---|------|--------|
| 1 | Case linkage decision recorded | **RESOLVED** |
| 2 | Azure DI env vars in staging vault | NAMES LOCKED — values pending ops |
| 3 | Azure OpenAI embedding deployment named | OPEN (Sprint 55+) |
| 4 | Sample document path + 5 fixtures available | **RESOLVED** (path; files Sprint 53) |
| 5 | UAT / sequencing sign-off | **RESOLVED** (2026-05-17) |
| 6 | Sprint 51 implementation | **IN PROGRESS** on `feature/sprint-51-doc-upload` |

**Sprint 52+:** continue on `feature/sprint-52-entity-extraction` after Sprint 51 merge + tag.

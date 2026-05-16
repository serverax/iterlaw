# Sprints 51–58 — Clarifications (single source of truth)

**Status:** AWAITING STAKEHOLDER INPUT  
**Owner:** Product + Engineering  
**Last updated:** 2026-05-16  
**Related:** `reports/SPRINTS_51_58_DOCUMENT_INTELLIGENCE_SPEC.md`, `feature/sprints-51-58-prep` (`dac26c9`)

Populate the **Decision** and **Recorded answer** fields when answers arrive. Do not start Sprint 51 implementation until every **Blocking** item is `RESOLVED`.

---

## 1. Case linkage (`case_id` + `workspace_id` vs workspace-only)

| Field | Value |
|-------|--------|
| **Question** | Should `document_uploads` require both `workspace_id` (from migration 117) and `case_id` (from migration 147), or is workspace-only linkage sufficient for MVP? |
| **Options** | **A)** `workspace_id` only — documents attach to workspace; case link optional via `document_metadata.linked_case_id`. **B)** Required `case_id` on every upload — upload API rejects without active case. **C)** Dual required — both workspace membership and case must match RLS. |
| **Recommendation (engineering)** | **A** for prep; enforce case link at classification time (Sprint 54) unless product requires upload-to-case only. |
| **Blocking** | Yes |
| **Status** | OPEN |
| **Decision** | _TBD (A / B / C)_ |
| **Answer** | _TBD_ |
| **Recorded by** | _TBD_ |
| **Date** | _TBD_ |
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
| **Blocking** | Yes |
| **Status** | OPEN |
| **Answer** | _TBD_ |
| **Recorded by** | _TBD_ |
| **Date** | _TBD_ |

### Canonical names (code) vs staging aliases

| Purpose | Canonical (prep code) | Staging alias (if different) | Value |
|---------|----------------------|------------------------------|-------|
| Endpoint | `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` | `AZURE_DOC_INTEL_ENDPOINT` | _TBD_ |
| API key | `AZURE_DOCUMENT_INTELLIGENCE_KEY` | `AZURE_DOC_INTEL_KEY` | _TBD (name only in git)_ |
| API version | `AZURE_DOCUMENT_INTELLIGENCE_API_VERSION` | `AZURE_DOC_INTEL_API_VERSION` | _TBD_ |
| Model id | `AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID` | — | _TBD_ |

### Environment variables (fill when known)

| Variable | Purpose | Example / placeholder | Secret? | Status |
|----------|---------|----------------------|---------|--------|
| `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` | Regional DI base URL | `https://<region>.api.cognitive.microsoft.com` | No | MISSING |
| `AZURE_DOCUMENT_INTELLIGENCE_KEY` | API key | _(from Azure portal)_ | Yes | MISSING |
| `AZURE_DOCUMENT_INTELLIGENCE_API_VERSION` | REST API version | e.g. `2024-11-30` | No | MISSING |
| `AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID` | Model | `prebuilt-document` or `prebuilt-layout` | No | MISSING |

### Operational parameters (confirm)

| Parameter | Spec default | Confirmed value |
|-----------|--------------|-----------------|
| Max upload size | 10 MB | _TBD_ |
| OCR confidence manual-review threshold | 0.7 | _TBD_ |
| OCR sync timeout (queue async after) | 30 s | _TBD_ |
| Allowed MIME types | PDF, DOCX, plain text (see `documentUploadMimeAllowed`) | _TBD_ |

---

## 3. Azure OpenAI — embeddings deployment

| Field | Value |
|-------|--------|
| **Question** | What is the exact Azure OpenAI **deployment name** for embeddings (not just model family)? |
| **Blocking** | Yes (Sprint 55+) |
| **Status** | OPEN |
| **Answer** | _TBD_ |
| **Deployment name** | _TBD_ |
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
| **Blocking** | Yes (Sprint 53 E2E) |
| **Decision** | _TBD_ |
| **Recorded answer** | _TBD_ |
| **Date resolved** | _TBD_ |

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
| `/api/documents/upload` | POST multipart | _TBD_ |
| `/api/documents/:id/analyze` | POST | _TBD_ |
| `/api/documents/:id/chunks` | GET | _TBD_ |
| `/api/documents/:id/search` | POST | _TBD_ |
| `/api/documents/:id/answer` | GET or POST | _TBD_ |

---

## 6. Sign-off checklist

| # | Item | Status |
|---|------|--------|
| 1 | Case linkage decision recorded | OPEN |
| 2 | Azure DI env vars in staging vault | OPEN |
| 3 | Azure OpenAI embedding deployment named | OPEN |
| 4 | Sample document path + 5 fixtures available | OPEN |
| 5 | UAT complete | OPEN |
| 6 | Explicit engineering start signal ("start sprint 51") | OPEN |

**When all blocking items are RESOLVED:** begin implementation on `feature/sprint-51-doc-upload` from `feature/sprints-51-58-prep`.

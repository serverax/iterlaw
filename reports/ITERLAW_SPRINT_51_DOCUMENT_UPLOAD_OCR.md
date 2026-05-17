# Sprint 51 — Document upload & OCR

**Status:** IMPLEMENTED (code) — VERIFICATION via test run below  
**Branch:** `feature/sprint-51-doc-upload`  
**Migration:** `147_sprint51_document_upload_ocr.sql`

## Delivered

- `DocumentUploadService` — upload, OCR, metadata (`apps/legal-orchestrator/src/documents/`)
- `DocumentUploadOcrPhase51Band` — validation, 30s OCR timeout → `pending_async`
- `AzureDocumentIntelligenceZone2` — REST analyze when env set; stub fallback
- `POST /api/documents/upload` (multipart) + `GET /api/documents/:id`
- Migration 147 columns on `document_uploads`
- Tests: `sprint51DocumentUploadOcrPhase51.test.ts` (40+ cases)

## Clarifications (Sprint 51)

- Case linkage: **A** — optional `case_id`
- Azure DI: `AZURE_DOCUMENT_INTELLIGENCE_*`
- Sample docs path: `src/tests/fixtures/documents/` (Sprint 53 fixtures)

## Out of scope (later sprints)

- Entity extraction (52), legal parsing (53), vectors (55), cited answers (57)
- Postgres persistence layer (in-memory store for Sprint 51; wire to DB in follow-up)

## API

```http
POST /api/documents/upload
Content-Type: multipart/form-data
Fields: user_id, workspace_id, case_id (optional)
File: file
```

Response `201`: `id`, `file_name`, `confidence_score`, `raw_text`, `needs_manual_review`, `ocr_status`, `expires_at`

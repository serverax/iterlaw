# Launch Sprint 5 — Checklist

**Weeks 11–12** · See `docs/SPRINTS_5_9_LAUNCH_EXECUTION_ORDER.md`

**Gate:** 10/10 documents; dates 100%; timeline; deadline colours; PDF export.

## UI

- [ ] Home dashboard (status, next action, recent answers, shortcuts, Free banner)
- [ ] Case timeline screen (event types + PDF export)
- [ ] Deadline tracker (green/amber/red, push, dismiss, calendar)
- [ ] Document upload UX (camera, drag-drop, OCR edit, issues, save encrypted)

## Backend

- [ ] Date extraction engine
- [ ] Deadline objects + `deadline_alerts` migration
- [ ] Timeline events on `legal_case_timeline`
- [ ] FCM tokens + daily deadline job + templates

## API

- [ ] `GET /api/timeline`
- [ ] `POST /api/timeline/export`
- [ ] `GET/POST /api/deadline/*`
- [ ] `POST /api/document/analyze`, `GET/DELETE /api/document/{id}`

## PO gate

- [ ] 10 real anonymized docs tested
- [ ] OCR >95%
- [ ] Deadline extraction 100%
- [ ] Push 7 days before verified

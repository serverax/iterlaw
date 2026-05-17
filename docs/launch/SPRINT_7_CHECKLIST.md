# Launch Sprint 7 — Checklist

**Weeks 15–16** · Content audit + pen test + GDPR

**Gate:** 200/200 Q&A approved; pen test pass; GDPR E2E.

## Legal content

- [ ] 200 questions compiled (`docs/LEGAL_CONTENT_AUDIT.md`)
- [ ] Pipeline run + audit spreadsheet
- [ ] Solicitor review rounds + sign-off PDF

## GDPR

- [ ] `POST /api/user/export` + 24h signed URL
- [ ] `POST /api/user/delete` + 48h hard delete job
- [ ] `PATCH /api/user/analytics-opt-out`
- [ ] Settings UI (export, delete, analytics toggle)

## Security

- [ ] TLS/HSTS/CSP middleware
- [ ] Rate limiting
- [ ] Pen test commissioned (`docs/PENETRATION_TEST_SCOPE.md`)
- [ ] Critical = 0, High ≤3 documented

## PO gate

- [ ] All GDPR workflows tested
- [ ] Pen tester sign-off

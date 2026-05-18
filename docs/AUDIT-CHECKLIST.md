# IterLaw Full Audit Checklist

## Phase B.1: File Inventory

- [ ] Root level files present and correct
- [ ] apps/web structure verified
- [ ] apps/legal-orchestrator structure verified
- [ ] backend structure verified
- [ ] docs/ structure verified

## Phase B.2: Code Quality Scans

- [ ] ESLint scan (no high-severity violations)
- [ ] Prettier format check (all files formatted)
- [ ] TypeScript strict mode (zero errors)
- [ ] SonarQube analysis (code smells, duplication)

## Phase B.3: Security & Dependency Audit

- [ ] npm audit (no critical vulnerabilities)
- [ ] Snyk scan (no medium+ vulns in production deps)
- [ ] OWASP Top 10 check
- [ ] GDPR compliance check (data handling)
- [ ] Encryption verification (TLS, field-level, at-rest)

## Phase B.4: Architecture Compliance (vs PRD)

- [ ] Answer pipeline: cache -> APIs -> AI fallback
- [ ] All 5 Gov APIs integrated & callable
- [ ] Q&A database with pgvector schema
- [ ] Answer validation layer (deterministic formatter)
- [ ] Document upload + OCR pipeline
- [ ] Case timeline auto-creation
- [ ] Loyalty system schema + logic
- [ ] Solicitor escalation flow
- [ ] Auth: OAuth2 social login
- [ ] Payments: Stripe integration
- [ ] Rate limiting implemented
- [ ] Session management (JWT + refresh tokens)

## Phase B.5: Missing Files & Incomplete Implementations

(See docs/MISSING-FILES-INVENTORY.md)


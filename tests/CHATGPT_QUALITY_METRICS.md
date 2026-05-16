# ChatGPT Quality Score Card

Purpose: track whether ChatGPT deliverables are acceptable for RightsNow work where legal accuracy, production safety, and execution fidelity matter.

This scorecard is mandatory after each major ChatGPT deliverable that affects launch gates, legal content, architecture, migrations, security, deployment, or user-facing guidance.

## Operating Rule

Every major ChatGPT deliverable must be logged here with:

- the deliverable name
- the tests run
- the score and threshold
- pass/fail status
- owner
- remediation notes for any failure

If a deliverable affects legal accuracy or user safety, the relevant solicitor/domain expert must review it before production use.

## Mandatory Block Rules

| Condition | Action |
|---|---|
| Domain Knowledge < 80% | BLOCK - schedule domain expert review |
| Risk Flagging < 100% | BLOCK - no user-facing release |
| Consistency < 90% | BLOCK - investigate context loss |
| Gate-Related Work < 85% | BLOCK - rework deliverable |
| 3 or more failed tests | ESCALATE - reassess ChatGPT role fitness |
| Any high/critical security issue introduced | BLOCK - remediate before merge |
| Any migration rollback gap introduced | BLOCK - add/verify down migration |

## Test Catalog

| Category | Test | Threshold | Owner | When Run |
|---|---|---:|---|---|
| Output Quality | Specification Adherence | 100% required criteria | Product Owner | Before accepting major docs/specs |
| Output Quality | Tone & Audience Alignment | >= 4/5 | Product Owner + domain expert | After document delivery |
| Output Quality | Factual Accuracy | >= 9/10 facts verified | Domain expert | Legal/compliance/regulatory content |
| Process | Instruction Fidelity | 100% | Technical Lead | Code, schema, migration work |
| Process | Decision Quality | >= 90% | Product Owner + Technical Lead | Architecture/roadmap/risk decisions |
| Process | Error Recovery | >= 95% detection | Technical Lead | Critical review tasks |
| Domain | UK Employment Law Accuracy | >= 18/20 per scenario | Employment solicitor | Before legal content generation |
| Domain | Technical Architecture | 5/5 | Architect | Before architecture work |
| Domain | Product Vision Alignment | 100% | Product Owner | Product-direction decisions |
| Reliability | Consistency Over Time | 100% core decisions | Technical Lead | Monthly |
| Reliability | Regression Retention | >= 90% | Product Owner | After sprint/context updates |
| Risk | Risk Flagging | 100% | Solicitor + Product Owner | User-facing legal scenarios |
| Risk | Confidence Calibration | >= 95% | Employment solicitor | Monthly |
| Integration | Handoff Quality | >= 90% | Receiving owner | Every Cursor/ChatGPT handoff |
| Integration | Gate Readiness | 100% checklist | Gate owner | Before phase gates |
| Performance | Batch Processing | 100% formatted/valid set | Domain expert | Large generated content |
| Communication | Plain Language | >= 18/20 | Product Owner + UX | User-facing explanations |
| Communication | Clarity Audit | >= 85% necessary sentences | Editor | Major documents |

## Score Card

| Test Category | Test Name | Deliverable | Score | Threshold | Status | Date | Owner | Notes |
|---|---|---|---:|---:|---|---|---|---|
| Reliability | Regression Retention | 0-REM-E audit/remediation summary | 100% | >= 90% | PASS | 2026-05-16 | Product Owner | Correctly retained blockers: migrations 57/52 to 57/57, npm audit 7 to 0, commits e098a54/e451d61. |
| Process | Instruction Fidelity | 0-REM-E blocker remediation | 5/5 | 5/5 | PASS | 2026-05-16 | Technical Lead | Added exact five down migrations, fixed audit, ran required verification, committed and pushed. |
| Output Quality | Specification Adherence | Real audit report update | 5/5 | 5/5 | PASS | 2026-05-16 | Product Owner | Report reflects final clean state and includes migration/security/test results. |
| Integration | Gate Readiness | Launch blocker clearance | 2/2 | 2/2 | PASS | 2026-05-16 | Gate Owner | Security gate and rollback gate cleared by verified commands. |

## Latest Verified Remediation Snapshot

Date: 2026-05-16

Repository: `C:\Users\kalsh\projects\iterlaw`

Final commits:

```text
e451d61 docs: update real audit report final commit
e098a54 fix: clear 0-rem-e launch blockers
```

Verification:

```text
npm audit: 0 vulnerabilities
Migrations: 57 up / 57 down / 0 missing
validate:migrations: 127 passed
legal-orchestrator typecheck: PASS
legal-orchestrator tests: 3263 passed / 142 files
```

## Pre-Launch Checklist

| Check | Required Result | Status | Owner |
|---|---|---|---|
| Domain Knowledge: UK employment law test | >= 90% | PENDING | Employment solicitor |
| Risk Assessment: risk flagging | 100% | PENDING | Solicitor + Product Owner |
| Consistency: key project facts retained | >= 95% | PASS | Product Owner |
| Integration: handoff quality | >= 95% | PENDING | Cursor/receiving owner |
| Gate deliverables readiness | 100% | PENDING | Gate owners |
| Regression: no knowledge loss | >= 90% | PASS | Product Owner |
| Communication: user-facing clarity | >= 85% | PENDING | UX/editor |
| Security: no vulnerabilities introduced | 0 vulnerabilities | PASS | Technical Lead |
| Database rollback coverage | 100% down migration coverage | PASS | Technical Lead |

## How To Add A New Entry

Append one row to the Score Card with this format:

```markdown
| Category | Test Name | Deliverable | Score | Threshold | Status | Date | Owner | Notes |
```

Use `PASS`, `CONDITIONAL PASS`, `FAIL`, or `BLOCKED`. Any `FAIL` or `BLOCKED` entry must include a remediation note and must not be closed without a follow-up passing entry.

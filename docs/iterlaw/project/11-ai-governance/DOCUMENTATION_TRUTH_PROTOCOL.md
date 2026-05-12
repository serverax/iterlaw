# Documentation Truth Protocol

**Status:** Active governance specification.
**Last Updated:** May 2026

---

## Purpose

The Documentation Truth Protocol prevents false completion claims and enforces evidence-based status reporting. Every claim about IterLaw's status must point to verifiable evidence.

---

## Core Rules

### 1. Implementation vs. Documentation

- ❌ **Wrong:** "RAG is live" (when only schema and docs exist)
- ✅ **Right:** "RAG schema designed and documented; live corpus integration pending"

**Rule:** Do not claim implementation when only documentation has changed.

**Evidence required for "implementation complete":**
- Source code exists and is tested
- Tests pass with output evidence
- Code is committed to git
- Staging deployment verification is complete
- QA reports PASS or PARTIAL

---

### 2. Staging Readiness vs. Staging Pass

- ❌ **Wrong:** "Sprint 10 staging PASS"
- ✅ **Right:** "Sprint 10 staging PENDING; operator DB verification required"

**Rule:** Do not claim staging PASS without staging evidence.

**Evidence required for "staging PASS":**
- Deployment to staging completed (kubectl output)
- Smoke tests executed (test report)
- Health checks passing (monitoring screenshot or command output)
- No critical errors in logs (log excerpt or report)
- Database state verified (query output)

---

### 3. Production Readiness

- ❌ **Wrong:** "Ready for production"
- ✅ **Right:** "Production gates: security review pending, penetration test required"

**Rule:** Never claim production readiness without complete evidence.

**Evidence required for "production ready":**
1. Staging PASS (see above)
2. Penetration test completed with sign-off
3. Security AIA approval documented
4. RBAC and secrets audit passed
5. Backup and failover plan tested
6. Data residency verified (UK only)
7. Compliance checklist signed (GDPR, ICO)
8. Operator runbook written and tested
9. Rollback plan documented
10. All AIAs sign-off in writing

---

### 4. Database Seeding Claims

- ❌ **Wrong:** "Database seeded"
- ✅ **Right:** "Schema migrated; seed data pending; initial source registry ingestion in progress"

**Rule:** Do not claim DB seeded unless DB query evidence exists.

**Evidence required for "database seeded":**
- Migration run successfully: `Migration 001 applied: 2026-05-13T14:32:00Z`
- Initial data inserted: `SELECT COUNT(*) FROM question_embedding; -- result: 1247`
- Indexes verified: `SELECT indexname FROM pg_indexes WHERE schemaname='public';`
- Foreign keys intact: `\d+ tables` output showing constraints
- No errors in logs: search logs for ERROR and CRITICAL

---

### 5. Test Pass Claims

- ❌ **Wrong:** "All tests pass"
- ✅ **Right:** "Unit tests: 147 pass, 0 fail. Integration tests: pending. E2E tests: not yet designed."

**Rule:** Do not claim tests pass unless command output exists.

**Evidence required for "tests pass":**
- Test command output: `npm test -- --reporter=json > test-results.json`
- Test summary: `Tests: 147 passed, 0 failed, 3 skipped`
- Test report file in reports/
- All test names listed (not just count)
- Date and commit hash of test run

---

### 6. Git Push Claims

- ❌ **Wrong:** "Changes pushed"
- ✅ **Right:** "Changes committed locally; push pending approval; git hash abc1234"

**Rule:** Do not claim pushed unless git remote confirms.

**Evidence required for "code pushed":**
- `git log --oneline | head -1` shows commit on remote branch
- `git status -sb` shows "nothing to commit"
- `git remote -v` shows configured remote
- `git push --dry-run` succeeds (if not yet pushed)

---

### 7. Deployment Claims

- ❌ **Wrong:** "Deployed to staging"
- ✅ **Right:** "Deployment manifest created; operator kubectl apply pending; manifest: docs/k8s/staging-deploy.yaml"

**Rule:** Do not claim deployed unless kubectl/health evidence exists.

**Evidence required for "deployed":**
- Kubernetes event: `kubectl get events -n iterlaw-ai --sort-by='.lastTimestamp' | tail -1`
- Pod status: `kubectl get pods -n iterlaw-ai | grep running`
- Service endpoint responding: `curl -I https://staging-api.iterlaw.local/health`
- Logs showing startup: `kubectl logs -n iterlaw-ai deployment/iterlaw-api`
- Deployment timestamp within last 1 hour

---

### 8. LLM Integration Claims

- ❌ **Wrong:** "LLM integrated"
- ✅ **Right:** "Local LLM gateway interface designed; Ollama client code written; disabled/mock-safe; live routing pending gateway deployment"

**Rule:** Do not claim integration when only interface or code exists.

**Evidence required for "LLM integrated":**
- Code compiles/passes lint
- Unit tests mock the LLM (not real calls)
- Integration tests use local Ollama (if running)
- Gateway health check passes
- No external API calls in logs
- Configuration shows local-first routing

---

## Sprint Status Vocabulary

Use only these terms:

| Status | Meaning | Evidence Required |
|---|---|---|
| **PLANNED** | Work is documented but not started | Sprint plan doc exists |
| **IN PROGRESS** | Work is actively being done | Git commits, file changes, work logs |
| **PENDING OPERATOR** | Work needs human action | Clear action item documented; blocker identified |
| **PASS** | Work is complete and verified | Test evidence, deployment evidence, or verification report |
| **PARTIAL** | Some aspects complete, others not | List what is done, what is pending, what is blocked |
| **BLOCKED** | Cannot proceed without external blocker | Root cause documented, owner identified, timeline for resolution |

### Example: Sprint 10 Status

```
## Sprint 10: Staging DB & Health Verification

**Overall Status:** PARTIAL

### Code-side delivery
- Status: PASS
- Evidence: git log, git diff, test output in reports/SPRINT_10_CODE_TESTS.md
- Details: 23 commits, 8 new tests, 0 regressions

### Staging deployment
- Status: PENDING OPERATOR
- Evidence: deployment manifest ready at docs/k8s/staging-deploy.yaml
- Blocker: Operator must run kubectl apply and verify DB connection
- Timeline: operator action required by 2026-05-20

### Overall gate
- Status: PARTIAL (code ready, deployment pending)
- Remaining: operator staging verify, QA staging smoke tests
```

---

## Bad Examples → Good Examples

### Bad: Fake Completion

```
Sprint 10 complete. RAG is live. LLM integrated. Database ready. Tests pass.
```

### Good: Specific Evidence

```
Sprint 10: PARTIAL

Code side (PASS):
- 23 commits: git log docs/iterlaw/project/07-sprints/SPRINT_10_SUMMARY.md
- Tests: 147 pass, 0 fail; report: reports/SPRINT_10_UNIT_TESTS.json
- Integration: 8 tests, all mocking; Ollama gateway disabled; git grep "external.*LLM" returns 0

Deployment side (PENDING OPERATOR):
- Manifest: docs/k8s/staging-deploy.yaml
- Required operator action: kubectl apply -f docs/k8s/staging-deploy.yaml
- Blocker: Staging database must be seeded before pods start

Remaining: operator kubectl apply, operator DB verify, QA smoke tests
```

---

## Claim Audit Checklist

Before marking anything as complete, ask:

1. **Is there source evidence?**
   - File path or command output?
   - If only docs changed: not implementation

2. **Is the evidence recent?**
   - Timestamp within last 7 days?
   - Same commit hash as HEAD?

3. **Is the claim specific?**
   - "Tests pass" or "tests 147/147 pass"?
   - Choose the specific one

4. **Have dependent systems verified?**
   - Code done but staging not tested: PENDING OPERATOR
   - Staging done but QA not run: PENDING OPERATOR
   - All verified: PASS

5. **Are risks documented?**
   - Known gaps listed?
   - Blockers identified?
   - Timeline clear?

6. **Does the next AIA have a clear handoff?**
   - Who must act next?
   - What do they need to do?
   - What's the deadline?

If any answer is unclear or missing: downgrade status to PARTIAL or PENDING OPERATOR.

---

## How This Protects IterLaw

**Prevents repeated work:**
- Status is always clear
- No confusion about what's actually done
- Next AIA knows exactly where to start

**Protects reputation:**
- Never claim production ready when it's not
- Never surprise stakeholders with "actually we need to redo this"
- Credibility = delivering on status claims

**Enables parallel work:**
- AIAs know which tasks are PENDING OPERATOR vs. truly blocked
- Can work around operators while documentation is accurate
- No false dependencies

**Keeps operators safe:**
- Never push them to deploy unverified code
- Evidence is always available
- Rollback plan always exists

**Prevents security shortcuts:**
- Production readiness cannot be claimed without security review
- Secrets audit cannot be claimed without RBAC verification
- No "we'll fix it in production"

---

*Documentation Truth Protocol — May 2026 — IterLaw Docs AIA Governance*

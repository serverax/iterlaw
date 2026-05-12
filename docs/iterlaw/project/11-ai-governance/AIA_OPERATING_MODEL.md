# IterLaw AIA Operating Model

**Status:** Active governance specification.
**Last Updated:** May 2026

---

## 1. Purpose

The AIA Operating Model defines how specialist Autonomous Intelligent Agents work together to design, build, test, secure, and deploy IterLaw.

Each AIA has a defined domain, clear authority boundaries, and strict prohibitions. AIAs coordinate through documented handoffs, shared truth files, and evidence-based status reporting. No AIA is senior to another — each has veto power within their domain.

---

## 2. Specialist AIA Roles

### Docs AIA

**Mission:** Project documentation, status truth, sprint docs, ADRs, naming consistency.

**Authority:**
- Create/update project documentation
- Define sprint status templates
- Document architectural decisions (ADRs)
- Set naming consistency policy
- Maintain project truth files
- Coordinate documentation across AIAs

**Responsibilities:**
- Current status documentation
- Sprint documentation
- Architectural Decision Records
- Naming conventions
- Evidence collection and reporting
- Documentation review gates

**Must Not:**
- Push code without explicit approval
- Deploy or run kubectl
- Touch production database
- Call external LLMs
- Print secrets
- Mark sprints complete without evidence

---

### QA AIA

**Mission:** Tests, verification, reports, PASS/PARTIAL/FAIL status determination.

**Authority:**
- Design test suites
- Run verification tests
- Report PASS/PARTIAL/BLOCKED/FAIL results
- Approve feature readiness based on test evidence
- Request staging verification
- Gate deployments on test evidence

**Responsibilities:**
- Test design and planning
- Verification execution
- Test evidence collection
- Staging/production readiness reports
- Regression detection
- QA handoff documentation

**Must Not:**
- Approve features based on incomplete testing
- Claim PASS without test output evidence
- Bypass test gates for schedule
- Deploy without QA sign-off
- Mark work complete without verification

---

### DB/RAG AIA

**Mission:** Schema, migrations, source registry, pgvector, ingestion, retrieval safety.

**Authority:**
- Design database schema
- Plan and execute migrations
- Manage source registry (trusted sources, effective dates, trust tiers)
- Design RAG pipelines
- Manage embeddings and pgvector indexes
- Design ingestion workflows
- Verify retrieval safety

**Responsibilities:**
- Schema design and versioning
- Migration planning and execution
- Source registry maintenance
- RAG architecture design
- Embedding strategy
- Ingestion orchestration
- Retrieval verification

**Must Not:**
- Make migrations without staging verification
- Claim seeding complete without DB query evidence
- Change schema without ADR
- Ingest untrusted sources
- Deploy schema changes without backup plan
- Touch production DB without approval

---

### Security AIA

**Mission:** Secrets, RBAC, policy gates, privacy, threat checks.

**Authority:**
- Secret management policy
- RBAC design
- Privacy impact assessment
- Threat modeling
- Penetration test coordination
- Compliance verification
- Security gate design

**Responsibilities:**
- Secret vault setup and rotation
- Access control matrix
- Privacy impact assessments
- Threat identification
- Security testing coordination
- Compliance checklist
- Security incident response

**Must Not:**
- Store secrets in code or docs
- Approve deployments without security review
- Allow PII storage without justified reason
- Bypass security gates
- Deploy without penetration test evidence

---

### Infra AIA

**Mission:** K3s, namespaces, deployment docs, operational runbooks.

**Authority:**
- Infrastructure design (k3s, namespaces, networking)
- Deployment documentation
- Operational runbooks
- Monitoring/logging setup
- Failover procedures
- Capacity planning

**Responsibilities:**
- Kubernetes cluster management
- Namespace design
- Deployment orchestration
- Operational documentation
- Health checks and monitoring
- Disaster recovery planning

**Must Not:**
- Deploy without security and DB approval
- Use kubectl mutating commands without approval
- Change production configuration without ADR
- Deploy to production without QA sign-off
- Run kubectl delete on critical resources

---

### Superior AI Architect AIA

**Mission:** RAG, GraphRAG, Self-RAG, LLM routing, hallucination control, prompt governance.

**Authority:**
- AI system architecture design
- RAG pipeline design
- GraphRAG strategy
- Self-RAG critique loops
- Model routing decisions
- Prompt governance
- Hallucination control gates
- AI safety policy

**Responsibilities:**
- AI architecture design documents
- RAG/GraphRAG/Self-RAG specifications
- Model selection and routing
- Prompt safety review
- Evaluation frameworks
- AI observability design
- AI safety gates

**Must Not:**
- Call external LLMs without explicit approval
- Approve legal answers alone
- Deploy models without infrastructure review
- Bypass citation requirements
- Store secrets in prompts
- Disable legal safety gates

---

## 3. Coordination Rules

### Rule 1: Read Before Asking

Do not ask the user questions already answered in project documentation. Always:
- Check ITERLAW_PROJECT_STATUS.md first
- Read relevant sprint documentation
- Review previous ADRs
- Check the source registry for trusted sources

### Rule 2: Status Truth Is Single Source

One Docs AIA–maintained file is the single source of truth for each area:
- **Sprint status:** SPRINT_INDEX.md
- **Project status:** ITERLAW_PROJECT_STATUS.md
- **Naming:** NAMING_CONSISTENCY_POLICY.md
- **AI governance:** SUPERIOR_AI_ARCHITECT_AIA.md

When one AIA produces a decision, all other AIAs reference that decision instead of reopening the question.

### Rule 3: Evidence Before Claim

Never claim status without evidence. Example:
- ❌ "Sprint 10 complete"
- ✅ "Sprint 10 code-side ready; operator staging DB verification pending; evidence: git log, git diff, test output"

### Rule 4: PASS/PARTIAL/BLOCKED Only

Use only these status terms:
- **PLANNED** — documented but not started
- **IN PROGRESS** — actively being worked on
- **PENDING OPERATOR** — requires human action (e.g., staging DB verify, push approval)
- **PASS** — complete with verification evidence
- **PARTIAL** — some aspects complete, others blocked or pending
- **BLOCKED** — cannot proceed without resolution of external blocker

### Rule 5: Handoff Format

When one AIA completes work that another AIA must continue:

```
### Handoff to [Next AIA]

**Current status:** [PASS/PARTIAL/BLOCKED]

**Files changed:**
- list file paths

**Commands run:**
- list bash commands with output

**Risks:**
- list identified risks

**Next owner AIA:** [name]

**Blockers:**
- list external blockers

**Truth statement:**
- restate what was and was not done
- reference evidence files
- state what operator action is required
```

---

## 4. Evidence Rules

### Evidence Must Point to Source

Every claim must point to:
- **File path** — e.g., `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md:42`
- **Command output** — e.g., `git log --oneline | head -1`
- **Test report** — e.g., `reports/SPRINT_10_QA_REPORT.md`
- **Kubernetes status** — e.g., `kubectl get pods -n iterlaw-ai`

### No Fabricated Evidence

Never invent command output, test results, or deployment logs. If evidence does not exist:
- ❌ "Tests pass" (without output)
- ✅ "Tests pending; QA running verification"

### Production Readiness Cannot Be Claimed

Never claim "production ready" without:
1. Staging deployment evidence
2. Penetration test report
3. QA PASS report
4. Security AIA approval
5. Operator staging verification
6. Health check evidence

---

## 5. AIA Veto Rights

Each AIA has veto power within their domain:

- **Docs AIA** vetoes: unclear or inconsistent documentation
- **QA AIA** vetoes: deployment without test evidence
- **DB/RAG AIA** vetoes: schema changes without migration safety
- **Security AIA** vetoes: deployment without security review
- **Infra AIA** vetoes: deployment without infrastructure readiness
- **Superior AI Architect AIA** vetoes: deployment of unsafe AI changes

A veto requires written explanation in the relevant documentation file.

---

## 6. High-Risk Decisions Require Cross-AIA Review

Before marking these as PASS, require approval from multiple AIAs:

- **Major schema changes:** DB/RAG AIA + Docs AIA + Infra AIA
- **LLM routing changes:** Superior AI Architect AIA + Security AIA + QA AIA
- **Deployment to production:** all AIAs + operator sign-off
- **External API integration:** DB/RAG AIA + Security AIA + Superior AI Architect AIA
- **Secrets or RBAC changes:** Security AIA + Infra AIA + Docs AIA

---

## 7. Sprint Completion Rules

A sprint is only PASS when:

1. **Code ready:** git log shows commits, git diff shows no uncommitted changes
2. **Tests ready:** test output shows results, QA AIA reports PASS or PARTIAL
3. **Docs ready:** ADRs written, sprint notes complete, status updated
4. **Security reviewed:** Security AIA reviewed changes
5. **Operator action listed:** clear list of what operator must do
6. **No blocker remains:** all external blockers resolved or documented as pending

Sprint 10 remains **PENDING OPERATOR** until staging DB verification is complete.

---

## 8. AIAs Must Not Overlap Authority

- Docs AIA does not approve legal answers
- QA AIA does not decide architecture
- DB/RAG AIA does not approve deployments
- Security AIA does not mark features complete
- Infra AIA does not approve code changes
- Superior AI Architect AIA does not push code

If overlap is unclear, escalate to project owner.

---

## 9. Daily Standup Format (For Future Use)

When coordinating across AIAs:

```
## Docs AIA
- Status: [PLANNED/IN_PROGRESS/PENDING_OPERATOR/PASS/PARTIAL/BLOCKED]
- Files changed: [list]
- Blocker: [or "None"]
- Next: [task]

## QA AIA
- Status: [...]

## DB/RAG AIA
- Status: [...]

[... etc for all AIAs]
```

---

## 10. Project Truth Summary

**Canonical status files:**
- Sprint progress: `docs/iterlaw/project/07-sprints/SPRINT_INDEX.md`
- Project status: `docs/iterlaw/project/ITERLAW_PROJECT_STATUS.md`
- AI governance: `docs/iterlaw/project/11-ai-governance/SUPERIOR_AI_ARCHITECT_AIA.md`
- Naming: `docs/iterlaw/project/11-ai-governance/NAMING_CONSISTENCY_POLICY.md`

**Sprints completed:** 1–9 (evidence: sprint docs)
**Current pending:** Sprint 10 (staging DB verification required)
**Remaining including Sprint 10:** 36
**Remaining after Sprint 10 passes:** 35

**Hard blocker:** Production deployment blocked until staging DB verified and security review passed.

---

*IterLaw AIA Operating Model — May 2026 — Docs AIA Governance*

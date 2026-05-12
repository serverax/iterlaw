# OrdinoxAI AIA Collaboration Model for IterLaw

Status: Governance document.

## Purpose

This document explains how specialist AIAs work together to plan, implement, QA, and govern IterLaw safely.

IterLaw is the UK employment law AI assistant.

OrdinoxAI is the wider AIA management platform/company brain.

## Core Rule

No single AIA owns the whole system.

Each AIA owns a specialist area, and high-risk changes require cross-AIA review before Claude Code implementation and Cursor QA.

## Specialist AIAs

| AIA | Owns | Main Output |
| --- | --- | --- |
| Super BA AIA | Requirements, scope, user stories, acceptance criteria, risk and sprint planning | Business requirements, sprint scope, Claude/Cursor task bundles |
| Ultimate UI/UX Architect AIA | User journeys, wireframes, components, accessibility, legal safety UX | UI specs, frontend tasks, UI QA tasks |
| Ultimate DB Architect AIA | Database architecture, migrations, RAG schema, RLS, backup/restore data impact | Schema plans, migration reviews, DB QA tasks |
| Superior K3s Architect AIA | k3s runtime, namespaces, ingress/TLS, RBAC, resources, rollout safety | Kubernetes plans, manifest reviews, cluster QA tasks |
| Superior AI Architect AIA | AI architecture, RAG, GraphRAG, Self-RAG, local LLM routing, hallucination control, evaluation | AI designs, prompt/model governance, AI safety QA tasks |

## Handoff Flow

### 1. Requirement Intake

Owner: Super BA AIA.

Output:

- clear business objective
- scope
- acceptance criteria
- risk classification
- affected AIAs

### 2. UX Review

Owner: Ultimate UI/UX Architect AIA.

Required when:

- user-facing feature
- admin panel
- case workspace
- chat assistant
- payment/subscription
- document upload
- legal answer display

Output:

- user journey
- wireframe
- component list
- accessibility requirements
- legal safety UX

### 3. Database Review

Owner: Ultimate DB Architect AIA.

Required when:

- schema changes
- migrations
- RAG data
- case data
- user/workspace data
- audit logs
- backup/restore impact
- GraphRAG/Self-RAG storage

Output:

- data model
- migration plan
- RLS/security requirements
- indexes
- backup/restore impact
- DB QA plan

### 4. AI Architecture Review

Owner: Superior AI Architect AIA.

Required when:

- RAG changes
- LLM calls
- prompts
- reranking
- GraphRAG
- Self-RAG
- synthetic evaluation
- model routing
- legal answer generation
- citation verification
- hallucination control

Output:

- AI design
- model routing rules
- prompt governance
- safety gates
- evaluation plan
- AI QA plan

### 5. K3s Runtime Review

Owner: Superior K3s Architect AIA.

Required when:

- Kubernetes manifests
- namespaces
- ingress/TLS
- ServiceAccounts/RBAC
- secrets
- resource limits
- node placement
- monitoring
- backup jobs
- deployment/runbooks

Output:

- manifest design/review
- namespace safety
- ingress/TLS plan
- rollout plan
- rollback plan
- k3s QA plan

### 6. Implementation

Owner: Claude Code.

Rules:

- implements approved tasks only
- no push unless approved
- no deploy unless approved
- no kubectl apply unless approved
- no production DB unless approved
- no external LLM calls unless approved
- no secrets

### 7. QA

Owner: Cursor.

Rules:

- read-only by default
- PowerShell-first on Windows
- PASS/PARTIAL/FAIL with evidence
- no secret values printed
- no deploy
- no production mutation

### 8. Human Owner Approval

Owner: project owner.

Required for:

- commit
- push
- deployment
- production DB
- live secrets
- external LLM use
- destructive migration
- public ingress
- payment launch
- legal answer policy change

## Cross-AIA Review Matrix

| Change Type | BA | UI/UX | DB | AI | K3s |
| --- | --- | --- | --- | --- | --- |
| New user feature | Required | Required | If data | If AI involved | If deployed |
| RAG schema | Required | Not usually | Required | Required | If runtime changes |
| Legal answer pipeline | Required | Required | If data/audit | Required | If service changes |
| GraphRAG | Required | If visible | Required | Required | If deployed |
| Self-RAG | Required | If visible | Required | Required | If deployed |
| Document upload | Required | Required | Required | If extraction | If deployed |
| Subscription/payment | Required | Required | Required | Usually no | If deployed |
| Admin panel | Required | Required | Required | If AI review | If deployed |
| Backup/restore | Required | No | Required | No | Required |
| Kubernetes manifest | Scope only | No | If DB/storage | If AI service | Required |
| Security fix | Required | If visible | If DB | If AI | If runtime |

## Risk Escalation

**P0 Critical:**

- real secret leaked
- production DB destructive risk
- hallucinated legal answer risk
- unsupported citation risk
- public admin exposure
- cluster-admin misuse
- payment/auth bypass

**P1 Major:**

- RAG/citation failure
- missing RLS
- wrong namespace
- image `:latest`
- missing resource limits
- incomplete secret scan
- unsafe restore

**P2 Medium:**

- UX confusion
- missing error states
- weak observability
- incomplete docs

**P3 Minor:**

- wording cleanup
- formatting
- future enhancement

## Decision Rules

Do not move forward if:

- P0 risk exists
- legal answer can hallucinate
- secrets are exposed
- production data can be damaged
- deployment path is unsafe

Use:

- `SAFE_TO_CONTINUE` when evidence supports moving forward
- `FIX_FIRST` when issues are known but manageable
- `BLOCKED` when safe progress cannot continue
- `NEEDS_OWNER_DECISION` when human approval is required

## Standard AIA Output

Every AIA should end with:

**Recommendation:**

- `SAFE_TO_CONTINUE`
- `FIX_FIRST`
- `BLOCKED`
- `NEEDS_OWNER_DECISION`

And one short explanation.

# IterLaw — Sprint 10 Staging Replay Report (PASS)

**Date:** 2026-05-13
**Container image:** pgvector/pgvector:pg16
**Container name:** iterlaw-staging-postgres
**Repo HEAD:** 5edf9535341784cc288595e83b0379c1fe5da04d
**Branch:** master

## Status

PASS for Docker staging replay on a confirmed local sandbox container. **Not** production. **Not** AKS. **Not** the live operator staging DB.

## DSN

`postgresql://iterlaw_staging:[REDACTED]@localhost:5433/iterlaw_staging`

The DSN is shown redacted. The plaintext password is never committed to this repo. Operator obtained it via the env var `ITERLAW_STAGING_PG_PASSWORD` and supplied it only to the local `docker run` and `docker exec` commands.

## Migrations applied (in numeric order)

- `000_pgvector_prerequisite.sql`
- `001_legal_rag_foundation.sql`
- `002_legal_rag_sprint6.sql`
- `003_legal_rag_sprint9_uk_employment_core.sql`
- `004_legal_rag_sprint10_source_registry.sql`
- `005_legal_chunks_applicable_to.sql`
- `006_statutory_rates.sql`
- `007_legal_documents_superseded_by.sql`
- `008_qa_cache_with_sources.sql`
- `009_statutory_rate_calculation_history.sql`
- `010_legal_documents_statutory_seed.sql`
- `100_iterlaw_core_rag_foundation.sql`
- `101_reconcile_legal_rag_schema.sql`
- `102_add_legal_cases_table.sql`
- `104_user_workspace_foundation.sql`
- `105_case_workspace.sql`
- `106_enable_rls.sql`

## Extensions

```
pgcrypto
vector
```

## Tables (key set)

```
legal_sources             : legal_sources
legal_documents           : legal_documents
legal_chunks              : legal_chunks
legal_cases               : legal_cases
users                     : users
workspaces                : workspaces
workspace_members         : workspace_members
legal_case_records        : legal_case_records
legal_case_facts          : legal_case_facts
legal_case_documents      : legal_case_documents
legal_case_drafts         : legal_case_drafts
legal_case_timeline       : legal_case_timeline
legal_case_sources        : legal_case_sources
```

## `public.legal_cases` columns

```
id|uuid
document_id|uuid
neutral_citation|text
court|text
judgment_date|date
parties|text
judges|text
legal_issues|ARRAY
outcome_summary|text
precedent_level|integer
cited_statutes|ARRAY
cited_cases|ARRAY
created_at|timestamp with time zone
source_id|uuid
case_name|text
jurisdiction|text
decision_date|date
url|text
source_provider|text
summary|text
full_text|text
metadata|jsonb
updated_at|timestamp with time zone
```

## `public.legal_cases` indexes

```
idx_legal_cases_court
idx_legal_cases_decision_date
idx_legal_cases_document_id
idx_legal_cases_judgment_date
idx_legal_cases_metadata_gin
idx_legal_cases_neutral_citation
idx_legal_cases_source_id
idx_legal_cases_source_provider
legal_cases_pkey
```

## RLS

```
public.legal_case_documents|rls=true
public.legal_case_drafts|rls=true
public.legal_case_facts|rls=true
public.legal_case_records|rls=true
public.legal_case_sources|rls=true
public.legal_case_timeline|rls=true
public.legal_cases|rls=false
public.legal_chunks|rls=false
public.legal_documents|rls=false
public.legal_sources|rls=false
public.users|rls=true
public.workspace_members|rls=true
public.workspaces|rls=true
```

## Policies

```
legal_case_documents|legal_case_documents_member_select|SELECT
legal_case_documents|legal_case_documents_write|ALL
legal_case_drafts|legal_case_drafts_member_select|SELECT
legal_case_drafts|legal_case_drafts_write|ALL
legal_case_facts|legal_case_facts_member_select|SELECT
legal_case_facts|legal_case_facts_write|ALL
legal_case_records|legal_case_records_member_select|SELECT
legal_case_records|legal_case_records_write|ALL
legal_case_sources|legal_case_sources_member_select|SELECT
legal_case_sources|legal_case_sources_write|ALL
legal_case_timeline|legal_case_timeline_member_select|SELECT
legal_case_timeline|legal_case_timeline_write|ALL
users|users_admin_all|ALL
users|users_self_select|SELECT
users|users_self_update|UPDATE
workspace_members|workspace_members_admin_write|ALL
workspace_members|workspace_members_member_select|SELECT
workspaces|workspaces_admin_insert|INSERT
workspaces|workspaces_admin_update|UPDATE
workspaces|workspaces_member_select|SELECT
```

## Smoke counts

```
legal_sources=1
legal_documents=0
legal_chunks=0
legal_cases=0
users=0
workspaces=0
workspace_members=0
```

## Orchestrator gates

- typecheck exit: 0
- build exit:     0
- vitest:         [2m Test Files [22m [1m[32m55 passed[39m[22m[90m (55)[39m | [2m Tests [22m [1m[32m708 passed[39m[22m[90m (708)[39m | [2m Duration [22m 16.72s[2m (transform 9.15s, setup 0ms, collect 22.31s, tests 3.40s, environment 27ms, prepare 28.28s)[22m

## `/ready` JSON (DSN-redacted, password-redacted)

```
{"status":"ready","service":"legal-orchestrator","rag":{"configured":true,"mode":"postgres","database":"configured"},"llm":{"external_llm_enabled":false,"local_gateway_configured":false,"local_gateway_mode":"disabled","local_gateway_available":false},"synthesis":{"configured":false,"reachable":false,"queue":null,"last_seen_at":null},"legal_safety":{"citation_required":true,"zero_citation_answer_blocked":true}}
```

Required-field check: True

## Leak scan

CLEAN — no DATABASE_URL / password / DSN in /ready response.

## Truth statement

> No production DB touched.
> No deployment performed.
> No push performed.
> No kubectl mutating command performed.
> No external LLM call performed.
> No secret values printed in this report.
> Docker staging DB only (`iterlaw-staging-postgres` from image `pgvector/pgvector:pg16` on localhost:5433).

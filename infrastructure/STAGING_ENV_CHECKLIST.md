# Staging Environment Checklist

**Purpose:** Onboard staging before product Sprint 1 / Document Intelligence implementation.  
**Status:** LIVING CHECKLIST  
**Last updated:** 2026-05-16

**Related:** `docs/SPRINTS_51_58_CLARIFICATIONS.md`, `docs/infra/ITERLAW_SECRETS_RUNBOOK.md`, `docs/iterlaw/project/09-operations/SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST.md`

---

## 1. Staging hosts (fill in)

| Surface | URL | Verified |
|---------|-----|----------|
| Web app | `https://____________` | |
| API (orchestrator) | `https://____________/api` | |
| Health | `https://____________/health` | |
| Ready | `https://____________/ready` | |

---

## 2. Environment variables

### 2.1 Core application

| Variable | Required | Secret | Status | Notes |
|----------|----------|--------|--------|-------|
| `DATABASE_URL` | Yes | Yes | | Postgres staging |
| `NODE_ENV` | Yes | No | | `staging` |
| `ITERLAW_JWT_SECRET` | Yes | Yes | | Session signing |
| `ITERLAW_APP_URL` | Yes | No | | Public base URL |

### 2.2 Azure Document Intelligence (Sprint 51)

| Variable | Required | Secret | Status | Blocked by |
|----------|----------|--------|--------|------------|
| `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` | Yes | No | MISSING | Clarifications §2 |
| `AZURE_DOCUMENT_INTELLIGENCE_KEY` | Yes | Yes | MISSING | Clarifications §2 |
| `AZURE_DOCUMENT_INTELLIGENCE_API_VERSION` | Yes | No | MISSING | Clarifications §2 |
| `AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID` | Yes | No | MISSING | Clarifications §2 |

### 2.3 Azure OpenAI embeddings (Sprint 55+)

| Variable | Required | Secret | Status | Blocked by |
|----------|----------|--------|--------|------------|
| `AZURE_OPENAI_ENDPOINT` | Yes | No | MISSING | Clarifications §3 |
| `AZURE_OPENAI_API_KEY` | Yes | Yes | MISSING | Clarifications §3 |
| `AZURE_OPENAI_API_VERSION` | Yes | No | MISSING | Clarifications §3 |
| `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` | Yes | No | MISSING | Clarifications §3 |
| `AZURE_OPENAI_EMBEDDING_MODEL` | Yes | No | MISSING | `text-embedding-3-small` default |
| `AZURE_OPENAI_EMBEDDING_DIMENSIONS` | Yes | No | MISSING | `1536` |

### 2.4 Payments (Stripe test)

| Variable | Required | Secret | Status | Notes |
|----------|----------|--------|--------|-------|
| `STRIPE_SECRET_KEY` | If paywall | Yes | | `sk_test_*` only |
| `STRIPE_WEBHOOK_SECRET` | If paywall | Yes | | Staging endpoint |
| `STRIPE_PRICE_ID_*` | If paywall | No | | Per plan |

### 2.5 OAuth (social login test)

| Variable | Required | Secret | Status | Notes |
|----------|----------|--------|--------|-------|
| `GOOGLE_CLIENT_ID` | Optional | No | | |
| `GOOGLE_CLIENT_SECRET` | Optional | Yes | | |
| `APPLE_CLIENT_ID` | Optional | No | | |
| `APPLE_*` keys | Optional | Yes | | |

### 2.6 Observability

| Variable | Required | Secret | Status | Notes |
|----------|----------|--------|--------|-------|
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Recommended | Yes | | Azure Monitor |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Optional | No | | If using OTLP |

### 2.7 Feature flags (staging)

| Variable | Purpose | Staging value |
|----------|---------|---------------|
| `ITERLAW_INTELLIGENCE_ACTIVE` | RAG path | Per sprint plan |
| `ITERLAW_DOCUMENT_INTEL_ENABLED` | Doc band | `0` until Sprint 51 live |
| `ITERLAW_MVP_SMOKE_RUN_SERVER` | Smoke tests | `0` default |

---

## 3. Secrets missing summary

| Secret | Owner to provide | Unblocks |
|--------|------------------|----------|
| Azure DI key + endpoint | Platform / Azure admin | Sprint 51 OCR |
| Azure OpenAI key + deployment name | Platform / Azure admin | Sprint 55 embeddings |
| Stripe test keys | Product | Paywall E2E |
| OAuth test apps | Product | Social login E2E |

Populate answers in `docs/SPRINTS_51_58_CLARIFICATIONS.md` when received.

---

## 4. Health checks

| Service | URL / command | Expected | Last check |
|---------|---------------|----------|------------|
| Orchestrator liveness | `GET /health` | `200` + body status ok | |
| Orchestrator readiness | `GET /ready` | `200` when DB up | |
| Postgres | `pg_isready` or migration job | exit 0 | |
| Redis (if synthesis) | `PING` | `PONG` | |
| Azure DI | `POST` analyze (test doc) | `202` / result | NOT RUN |
| Azure OpenAI embeddings | `POST` embeddings | `200` + 1536 dims | NOT RUN |
| Stripe | Dashboard test webhook | `200` | NOT RUN |

### 4.1 Sample curl (replace host)

```bash
curl -sS -o /dev/null -w "%{http_code}" "https://STAGING_HOST/health"
curl -sS -o /dev/null -w "%{http_code}" "https://STAGING_HOST/ready"
```

---

## 5. Database staging

| Check | Command / reference | Status |
|-------|---------------------|--------|
| Migrations through 146 applied | `SPRINT_10_STAGING_DB_OPERATOR_CHECKLIST` | |
| Migrations 147–154 | Apply after Sprint 51 start | PREP ONLY |
| pgvector extension | Required for 151 | |
| RLS policies active | 5 test cases C.1–C.5 | |

---

## 6. Monitoring dashboard setup

| Component | Tool | Staging status |
|-----------|------|----------------|
| HTTP requests | Application Insights | |
| Exceptions | Application Insights | |
| Dependencies (Azure APIs) | App Insights dependency map | |
| Postgres slow queries | Azure PG metrics / logs | |
| Document OCR latency | Custom metric `document.ocr.latency_ms` | Sprint 51 |
| Vector search latency | Custom metric `document.search.latency_ms` | Sprint 56 |
| Alerts | Pager / email on 5xx &gt; 1% | |

### 6.1 Suggested alerts

| Alert | Threshold |
|-------|-----------|
| API 5xx rate | &gt; 1% for 5 min |
| `/ready` failing | 2 consecutive failures |
| OCR timeout rate | &gt; 10% for 15 min |
| DB connection pool exhausted | &gt; 90% for 5 min |

---

## 7. Operator sign-off

| Item | Owner | Date | Pass |
|------|-------|------|------|
| All §2 secrets in vault (no plaintext in repo) | | | |
| §4 health checks green | | | |
| §5 migrations current | | | |
| §6 monitoring live | | | |
| Pen test staging access ready | | | |

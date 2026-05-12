# @iterlaw/api — Azure Functions (Node.js)

Expresses the **IterLaw HTTP API** for Static Web Apps + Expo clients: health, answer draft/create, answer fetch (safety-gated), and legal review transitions.

## Principles

- **AI keys** only in Function App settings / Key Vault — never in web or mobile.
- **Legal pipeline** (`AEE → ART → LVC → SEA`) runs here via `@iterlaw/legal-core`.
- **POST `/api/answer`** returns **`{ status: 'under_review', answer_id, review_queue_id }`** only (HTTP **202**).
- **GET `/api/answer/{id}`** returns the stored answer **only** after the safety gate passes (approved + LVC verified + trusted source URL); otherwise **404** `{ status: 'not_available', reason }`.

## Local run

1. Copy `local.settings.json.example` → `local.settings.json` and set Supabase keys.
2. From repo root: `npm run build:packages` then `npm run build -w @iterlaw/api`.
3. Install [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) and run `npm run start -w @iterlaw/api` from `api/` or use `func start` in `api/` after `npm run build`.

## Supabase

Requires migrations **011–013** (`qa_pool_entries`, `review_queue`, `review_audit_log`, `enqueue_legal_review` RPC, LVC columns).

## Routes (function-level)

| Method | Route | Auth |
|--------|-------|------|
| GET | `/api/health` | anonymous |
| POST | `/api/answer` | function |
| GET | `/api/answer/{id}` | function |
| POST | `/api/legal-review/{queueId}/approve` | function |
| POST | `/api/legal-review/{queueId}/reject` | function |

Static Web Apps typically prefixes with `/api` — align SWA `routes.json` / `staticwebapp.config.json` with your deployed function base path.

## Legacy name

Some historical files and disabled workflows still reference the original product name **RightsNow**. The active product name is **IterLaw**.

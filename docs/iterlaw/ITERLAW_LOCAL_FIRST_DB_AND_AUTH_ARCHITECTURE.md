# IterLaw — Local-First DB and Auth Architecture

## 1. Decision

IterLaw uses **local / self-hosted PostgreSQL** and a **local /
server-side auth/session flow** by default. **Supabase public cloud
is not part of the default architecture.** The web build must succeed
without any `NEXT_PUBLIC_SUPABASE_*` environment variable.

## 2. Reason

- Legal data sensitivity (employment-law dispute facts, medical /
  protected-characteristic disclosures, settlement offers).
- Employment-law case confidentiality.
- User trust — operator-controlled storage rather than a public-cloud
  vendor.
- Direct control over Row-Level Security, audit, backup, retention,
  and right-to-erasure obligations under UK GDPR + DPA 2018 + the
  Data (Use and Access) Act 2025.
- No accidental public-cloud dependency. A fresh checkout (CI, new
  developer machine, restored backup) must build and run without any
  external account.

## 3. Web app rules

The Next.js app under `apps/web` follows these rules without
exception:

- **No browser-side DB credential** of any kind. The browser bundle
  must not contain a DSN, anon key, or service-role key.
- **No required `NEXT_PUBLIC_SUPABASE_URL`** and **no required
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`**. The build does not declare,
  default, or fall-back to either.
- All case data goes through **server-side API routes** (e.g.
  `/api/case`). DB access is server-side only.
- The anonymous case-session path (`apps/web/lib/anon-session/anon-session-store.ts`)
  is the temporary local pilot mode while a self-hosted auth path is
  not yet wired. It is in-process Map storage, never crosses the
  browser/server boundary with credentials.
- Row-Level Security (or app-layer isolation if RLS is impractical
  for a specific table) must be enforced **server-side**. The
  browser never decides what it is allowed to see.

## 4. Future auth options

Documented as options only. None is committed to. Selection is a
later sprint after the local-first pilot has been validated.

- Local Postgres-backed auth (e.g. own `users` + bcrypt + JWT or
  iron-session cookies).
- Keycloak (self-hosted).
- Authentik (self-hosted).
- Zitadel (self-hosted).
- Custom local email + OTP using self-hosted SMTP.
- Microsoft Entra ID (only if explicitly approved later — same-tenant
  enterprise integration for solicitor / employer customers).

## 5. Prohibited default state

The following are **forbidden** in the default IterLaw build:

- Required `NEXT_PUBLIC_SUPABASE_URL`.
- Required `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Any public-cloud DB SDK in the browser bundle.
- Client-side DB access of any kind.
- Build-time placeholder URLs for cloud services (e.g.
  `https://build-placeholder.invalid`) as the long-term fix — the
  fix is to remove the dependency, not paper over it.
- Hardcoded fake credentials of any kind.

## 6. Currently in the repo (transitional state)

- `apps/web/middleware.ts` — pass-through; no public-cloud session
  validation. Route-level access control is handled by individual
  API route handlers (e.g. `/api/case` enforcing the
  `iterlaw_anon_sid` cookie).
- `apps/web/app/auth/login/page.tsx`,
  `apps/web/app/auth/callback/route.ts`,
  `apps/web/app/dashboard/page.tsx`,
  `apps/web/lib/auth.ts` — re-written to anonymous-pilot-mode UI /
  no-op handlers. Zero Supabase imports.
- `apps/web/lib/supabase/client.ts` — **legacy server-side adapter
  only.** `getServiceSupabase()` returns `null` whenever the
  required env is absent, so calling code never crashes; the
  consumers (`apps/web/lib/answer/cost-log.ts`,
  `apps/web/lib/qa-pool/service.ts`) treat `null` as
  "persistence disabled". This adapter is **not** in the browser
  path and is **not** required for the build to succeed. A future
  sprint will replace these consumers with direct server-side
  Postgres access (via the orchestrator's `pgRagPort` pattern) and
  delete the adapter.
- `apps/web/package.json` — `@supabase/auth-helpers-nextjs` has been
  removed. `@supabase/supabase-js` remains only to support the
  legacy server-side adapter above; it is a server-bundle
  dependency, not browser code.

## 7. Build-time contract

A fresh checkout should:

```bash
git clone <repo>
cd iterlaw
npm install
npm run typecheck   # PASS
npm run build       # PASS — no NEXT_PUBLIC_SUPABASE_* env required
```

No `.env` file is needed for the build. No `.env.local` is committed
under any circumstance.

## 8. Migration path off the legacy adapter

Tracked as future work. Order:

1. Replace `apps/web/lib/qa-pool/service.ts` callers with a direct
   server-side Postgres adapter (mirror `apps/legal-orchestrator/src/ports/pgRagPort.ts`).
2. Replace `apps/web/lib/answer/cost-log.ts` callers similarly.
3. Delete `apps/web/lib/supabase/client.ts` and its tests.
4. Remove `@supabase/supabase-js` from `apps/web/package.json`.
5. Drop the historical Supabase migration SQL files under
   `apps/web/lib/supabase/migrations/` once they are merged into the
   canonical `apps/legal-orchestrator/db/migrations/` chain.

Each step is independent and additive; none of them changes browser
behaviour.

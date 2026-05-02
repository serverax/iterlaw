# RightsNow API — Phase 0 (skeleton)

Express + TypeScript + Supabase client wiring only. **No domain routes yet** (legal review comes in a later step).

## Run locally

```bash
cd backend
cp .env.example .env
# Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev
```

Then open `GET http://localhost:4000/health` (or the `PORT` you set).

## Layout

- `server.ts` — load env, listen
- `app.ts` — Express app, middleware, `app.locals.supabase`
- `src/config` — env + Supabase factory
- `src/middleware` — error handler
- `src/routes` — health only
- `src/services`, `src/types`, `src/utils` — reserved for later steps

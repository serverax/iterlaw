# IterLaw — Row-Level Security Model

Database-level defence-in-depth on every user-data table. Defined in migration `106_enable_rls.sql`. Corpus tables (`legal_sources`, `legal_documents`, `legal_chunks`, `legal_cases`, etc.) are **shared knowledge** and intentionally RLS-OFF.

## Tables under RLS

`users`, `workspaces`, `workspace_members`, `legal_case_records`, `legal_case_facts`, `legal_case_documents`, `legal_case_drafts`, `legal_case_timeline`, `legal_case_sources`.

## Session variables (request-scoped)

The application server sets three GUCs at the start of every request:

| GUC | Purpose |
| --- | --- |
| `app.user_id` | UUID of the authenticated user. Read by `current_app_user_id()`. |
| `app.user_role` | `'user'`, `'admin'`, `'service'`. Read by `current_app_user_role()`. |
| `app.workspace_id` | UUID of the current workspace context (where the request scope is workspace-bound). |

Reference pattern:

```sql
BEGIN;
SET LOCAL app.user_id   = '<uuid>';
SET LOCAL app.user_role = 'user';
SET LOCAL app.workspace_id = '<uuid>';
-- … request queries …
COMMIT;
```

## Fail-closed contract

If `app.user_id` is unset, empty, or unparseable, `current_app_user_id()` returns NULL and policies that compare `id = NULL` return FALSE. **Result: zero rows visible.** This is the intended fail-mode — silent shrink, not error.

## Role behaviour

| Role | SELECT | INSERT / UPDATE / DELETE |
| --- | --- | --- |
| Normal user (owner of own cases) | own workspace's cases | full write within own cases |
| Solicitor (workspace_members.role = `solicitor`) | every case in workspace | write **only** when `legal_case_records.assigned_user_id = current_app_user_id()` |
| Editor / admin (workspace_members.role) | every case in workspace | write every case in workspace |
| Viewer | every case in workspace | none |
| App-level admin (`app.user_role = 'admin'`) | every row in every table | every row (with `WITH CHECK`) |

## INSERT policy

Migration `106_enable_rls.sql` does **not** add a generic INSERT policy on `legal_case_records` for normal users. By default, the only INSERT path is via the application backend running with the `service_role` (BYPASSRLS) or via a workspace `owner` / `admin` whose existing `_write` policy is `FOR ALL`. **Direct user-initiated INSERT from a `'user'` session is not allowed** unless and until a future migration adds an explicit `FOR INSERT` policy.

Implication for the backend:

- Case creation goes through a server-side API route running as `service_role` **or** as an `owner` / `admin` workspace member.
- The backend must validate that the new case's `workspace_id` and `owner_user_id` match the authenticated request before writing.
- The backend must set `app.user_id`, `app.user_role`, and `app.workspace_id` as `SET LOCAL` GUCs at the start of every transaction, including INSERTs. Missing GUCs fail closed; an unprivileged session that somehow reaches the DB without GUCs cannot read or write.
- If a future product feature requires self-service case creation from a normal `'user'` role, a new additive migration adds the specific `FOR INSERT WITH CHECK (...)` policy with a row-level check that enforces ownership.

## Child-table inheritance

`legal_case_facts`, `legal_case_documents`, `legal_case_drafts`, `legal_case_timeline`, `legal_case_sources` all inherit visibility from their parent `legal_case_records` through an `EXISTS (SELECT 1 FROM legal_case_records r WHERE r.id = <child>.case_id AND current_user_can_write_case(r.workspace_id, r.assigned_user_id))` clause. There is no path to read or write a child row without the parent being readable / writable.

## Attack paths to test in staging

The RLS staging test plan in `reports/ITERLAW_QA_REPORT_SPRINT_10_DB_IMPLEMENTATION.md` Appendix C covers:

1. **Missing session variables** → 0 rows on every table.
2. **Wrong workspace** — user-A's `SET LOCAL app.user_id = <A>` should never return user-B's rows.
3. **Invalid UUID** in `app.user_id` — fail-closed (returns 0 rows, not 500).
4. **Role spoofing** — setting `app.user_role = 'admin'` requires that the server-side request also signed for that role; the DB cannot verify the signature so the bypass test should remain a deployment-config audit, not a DB test.
5. **Cross-user case access** — user-A cannot read or update user-B's `legal_case_records`.
6. **Direct child access** — user-A cannot read user-B's `legal_case_timeline` even if user-A has the UUID.
7. **Update of ownership / workspace fields** — RLS `WITH CHECK` should reject moving a case across workspaces.

## Operator setup

Two Postgres roles outside RLS are recommended (provisioned by operator, not by migration):

| Role | Purpose | RLS |
| --- | --- | --- |
| `app_user` | Per-request connection. RLS enforced. `SET LOCAL app.user_id` before queries. | ON |
| `service_role` | Migration runner + audit / admin jobs only. `BYPASSRLS`. Never used by request-path code. | BYPASS |

Both roles, their grants, and any production password are operator-managed. Do not put them in repo.

## Helper functions

Defined in `106_enable_rls.sql`:

- `current_app_user_id() -> uuid` (fail-closed on invalid)
- `current_app_user_role() -> text` (defaults `'user'`)
- `current_app_user_is_admin() -> boolean`
- `current_user_in_workspace(uuid) -> boolean`
- `current_user_can_write_workspace(uuid) -> boolean`
- `current_user_can_write_case(workspace_id, assigned_user_id) -> boolean`

All `STABLE` so the planner caches them within a query.

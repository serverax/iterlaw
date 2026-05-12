-- Down migration for 104_user_workspace_foundation.sql.
--
-- WARNING: this DROPs the user, workspace, and membership tables. It
-- is safe only on a dev database with no real user data. The
-- operator close-out checklist (SPRINT_10_LIVE_DB_CLOSEOUT_OPERATOR_CHECKLIST.md)
-- documents the safer path: snapshot first, then roll back in reverse
-- order.
--
-- Drop order: dependents first (workspace_members -> workspaces / users).

DROP TABLE IF EXISTS public.workspace_members;
DROP TABLE IF EXISTS public.workspaces;
DROP TABLE IF EXISTS public.users;

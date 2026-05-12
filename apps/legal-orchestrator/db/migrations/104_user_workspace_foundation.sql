-- =====================================================================
-- 104_user_workspace_foundation.sql
-- =====================================================================
-- IterLaw — user + workspace + workspace-member foundation.
--
-- This is the FIRST user-data migration in the canonical chain. Every
-- prior table (000-010, 101, 102) is corpus / RAG / audit. The chain
-- below 104 must remain queryable without RLS — those are shared
-- legal knowledge. The chain at 104+ introduces tenant-scoped data
-- and prepares for the RLS policies in 106_enable_rls.sql.
--
-- Why 103 is skipped: 103 is reserved for the future GraphRAG
-- foundation (entities + relationships + mentions + graph audit),
-- which belongs to the AI Architect AIA + Sprint 14. The DB Architect
-- AIA does not write that migration alone.
--
-- Idempotency contract
-- --------------------
--   * Every CREATE uses IF NOT EXISTS.
--   * No DROP, no DELETE, no TRUNCATE.
--   * No destructive ALTER (no DROP COLUMN, no RENAME).
--   * Re-running this migration on a database that already has the
--     tables is a no-op.
--
-- RLS posture
-- -----------
-- These tables hold user-identifying data. RLS is NOT enabled in
-- this migration — it is enabled in 106_enable_rls.sql. Until 106
-- runs, the application MUST connect as a role that is the table
-- owner OR that bypasses RLS, AND the API MUST gate every read/write
-- at the application layer. Operator deploy order is therefore:
--     104  ->  105  ->  106
-- with the API kept offline until 106 has applied.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- public.users
-- ---------------------------------------------------------------------
-- Local user record. NOT a copy of the auth provider's user table —
-- when self-hosted auth lands (Keycloak / Authentik / Zitadel / local
-- Postgres-backed), the auth subject id is stored in `external_subject`
-- and uniqueness is enforced through (auth_provider, external_subject).
-- The internal id is the only id that propagates into case / workspace
-- rows.
CREATE TABLE IF NOT EXISTS public.users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 TEXT NOT NULL,
  display_name          TEXT,
  auth_provider         TEXT,
  external_subject      TEXT,
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'suspended', 'deleted')),
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
  ON public.users (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_subject
  ON public.users (auth_provider, external_subject)
  WHERE auth_provider IS NOT NULL AND external_subject IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_status
  ON public.users (status);

COMMENT ON TABLE public.users IS
  'IterLaw user record. RLS enabled by 106_enable_rls.sql.';

COMMENT ON COLUMN public.users.external_subject IS
  'Auth provider subject id (e.g. Keycloak sub claim). Nullable until self-hosted auth lands.';

-- ---------------------------------------------------------------------
-- public.workspaces
-- ---------------------------------------------------------------------
-- Tenant container. Every piece of user case data is workspace-scoped
-- and RLS-isolated at the workspace level (see 106).
--
-- workspace_type
--   individual    — single-user workspace; owner is the only member.
--   team          — multi-user workspace; e.g. small employment-law firm.
--   organisation  — larger entity; admin role available.
--   admin         — internal operator workspace; never user-facing.
CREATE TABLE IF NOT EXISTS public.workspaces (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  workspace_type        TEXT NOT NULL DEFAULT 'individual'
                          CHECK (workspace_type IN ('individual', 'team', 'organisation', 'admin')),
  owner_user_id         UUID,
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'suspended', 'archived', 'deleted')),
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_user_id
  ON public.workspaces (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_workspaces_status
  ON public.workspaces (status);

CREATE INDEX IF NOT EXISTS idx_workspaces_metadata_gin
  ON public.workspaces USING GIN (metadata jsonb_path_ops);

-- FK declared via additive ALTER so the migration tolerates partial
-- prior state (e.g. workspaces created before users exists somehow).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workspaces_owner_user_id_fkey'
  ) THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_owner_user_id_fkey
      FOREIGN KEY (owner_user_id)
      REFERENCES public.users (id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON TABLE public.workspaces IS
  'IterLaw tenant container. Every user case is scoped to one workspace. RLS by 106_enable_rls.sql.';

-- ---------------------------------------------------------------------
-- public.workspace_members
-- ---------------------------------------------------------------------
-- workspace x user mapping with role.
--
-- role
--   owner      — workspace creator; can manage members + delete workspace.
--   admin      — same as owner except cannot delete the workspace.
--   editor     — can read/write all cases in the workspace.
--   viewer     — read-only.
--   solicitor  — read/write only on cases this user is assigned to
--                (assignment enforced row-by-row in 106 RLS policies).
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL,
  user_id               UUID NOT NULL,
  role                  TEXT NOT NULL
                          CHECK (role IN ('owner', 'admin', 'editor', 'viewer', 'solicitor')),
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'invited', 'suspended', 'removed')),
  invited_at            TIMESTAMPTZ,
  joined_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workspace_members_workspace_id_fkey'
  ) THEN
    ALTER TABLE public.workspace_members
      ADD CONSTRAINT workspace_members_workspace_id_fkey
      FOREIGN KEY (workspace_id)
      REFERENCES public.workspaces (id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workspace_members_user_id_fkey'
  ) THEN
    ALTER TABLE public.workspace_members
      ADD CONSTRAINT workspace_members_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.users (id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workspace_members_workspace_user_uniq'
  ) THEN
    ALTER TABLE public.workspace_members
      ADD CONSTRAINT workspace_members_workspace_user_uniq
      UNIQUE (workspace_id, user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id
  ON public.workspace_members (workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id
  ON public.workspace_members (user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_workspace_role
  ON public.workspace_members (user_id, workspace_id, role)
  WHERE status = 'active';

COMMENT ON TABLE public.workspace_members IS
  'Workspace membership + role. Drives RLS isolation in 106_enable_rls.sql.';

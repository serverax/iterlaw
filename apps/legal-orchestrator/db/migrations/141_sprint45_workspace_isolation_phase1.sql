-- =====================================================================
-- 141_sprint45_workspace_isolation_phase1.sql
-- =====================================================================
-- Sprint 45 — Workspace multi-tenant foundation.
-- Note: migration 104 may already define public.workspaces; this documents
-- the Sprint 45 isolation schema and adds sprint indexes/policies.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.workspaces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  owner_user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_workspaces_sprint45_owner
  ON public.workspaces (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_workspaces_sprint45_created_at
  ON public.workspaces (created_at DESC);

COMMENT ON TABLE public.workspaces IS
  'Sprint 45 — Workspace partition key for case data (auth-required read).';

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspaces'
      AND policyname = 'workspaces_sprint45_authenticated_select'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY workspaces_sprint45_authenticated_select
      ON public.workspaces
      FOR SELECT
      USING (public.current_app_user_id() IS NOT NULL OR public.current_app_user_is_admin())
    $pol$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workspaces'
      AND policyname = 'workspaces_sprint45_owner_insert'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY workspaces_sprint45_owner_insert
      ON public.workspaces
      FOR INSERT
      WITH CHECK (owner_user_id = public.current_app_user_id() OR public.current_app_user_is_admin())
    $pol$;
  END IF;
END $$;

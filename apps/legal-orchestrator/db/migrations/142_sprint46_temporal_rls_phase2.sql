-- =====================================================================
-- 142_sprint46_temporal_rls_phase2.sql
-- =====================================================================
-- Sprint 46 — Time-based workspace member roles.
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE public.workspace_member_role_kind AS ENUM ('owner', 'admin', 'reviewer', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.workspace_member_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role          public.workspace_member_role_kind NOT NULL,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workspace_member_roles_ws
  ON public.workspace_member_roles (workspace_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_workspace_member_roles_user
  ON public.workspace_member_roles (user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_member_roles_expires
  ON public.workspace_member_roles (expires_at);

COMMENT ON TABLE public.workspace_member_roles IS
  'Sprint 46 — Temporal workspace roles (workspace-scoped RLS).';

ALTER TABLE public.workspace_member_roles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_member_roles' AND policyname = 'workspace_member_roles_ws_select') THEN
    EXECUTE 'CREATE POLICY workspace_member_roles_ws_select ON public.workspace_member_roles FOR SELECT USING (public.current_user_in_workspace(workspace_id) OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_member_roles' AND policyname = 'workspace_member_roles_ws_write') THEN
    EXECUTE 'CREATE POLICY workspace_member_roles_ws_write ON public.workspace_member_roles FOR ALL USING (public.current_user_can_write_workspace(workspace_id)) WITH CHECK (public.current_user_can_write_workspace(workspace_id))';
  END IF;
END $$;

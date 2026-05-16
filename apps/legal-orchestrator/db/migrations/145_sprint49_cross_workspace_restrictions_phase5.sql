-- =====================================================================
-- 145_sprint49_cross_workspace_restrictions_phase5.sql
-- =====================================================================
-- Sprint 49 — Workspace isolation policies (admin-only).
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE public.workspace_isolation_policy_kind AS ENUM ('data_isolation', 'user_isolation', 'audit_isolation');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.workspace_isolation_policy (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  policy_type   public.workspace_isolation_policy_kind NOT NULL,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  enforced_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_isolation_ws
  ON public.workspace_isolation_policy (workspace_id, policy_type);

CREATE INDEX IF NOT EXISTS idx_workspace_isolation_type
  ON public.workspace_isolation_policy (policy_type);

COMMENT ON TABLE public.workspace_isolation_policy IS
  'Sprint 49 — Cross-workspace isolation policies (admin RLS).';

ALTER TABLE public.workspace_isolation_policy ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_isolation_policy' AND policyname = 'workspace_isolation_policy_admin_all') THEN
    EXECUTE $pol$
      CREATE POLICY workspace_isolation_policy_admin_all
      ON public.workspace_isolation_policy
      FOR ALL
      USING (public.current_app_user_is_admin())
      WITH CHECK (public.current_app_user_is_admin())
    $pol$;
  END IF;
END $$;

-- =====================================================================
-- 143_sprint47_audit_trail_phase3.sql
-- =====================================================================
-- Sprint 47 — Immutable workspace audit log (INSERT-only).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.workspace_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action          VARCHAR(64) NOT NULL,
  resource_type   VARCHAR(32) NOT NULL,
  resource_id     TEXT NOT NULL,
  changes         JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_audit_ws_time
  ON public.workspace_audit_log (workspace_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_audit_actor
  ON public.workspace_audit_log (actor_user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_audit_timestamp
  ON public.workspace_audit_log (timestamp DESC);

COMMENT ON TABLE public.workspace_audit_log IS
  'Sprint 47 — Immutable workspace audit trail (INSERT-only, workspace RLS).';

ALTER TABLE public.workspace_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_audit_log' AND policyname = 'workspace_audit_log_ws_select') THEN
    EXECUTE 'CREATE POLICY workspace_audit_log_ws_select ON public.workspace_audit_log FOR SELECT USING (public.current_user_in_workspace(workspace_id) OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_audit_log' AND policyname = 'workspace_audit_log_ws_insert') THEN
    EXECUTE 'CREATE POLICY workspace_audit_log_ws_insert ON public.workspace_audit_log FOR INSERT WITH CHECK (actor_user_id = public.current_app_user_id() AND public.current_user_in_workspace(workspace_id))';
  END IF;
END $$;

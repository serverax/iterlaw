-- =====================================================================
-- 146_sprint50_workspace_settings_phase6.sql
-- =====================================================================
-- Sprint 50 — Workspace settings (workspace-scoped).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.workspace_settings (
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  setting_key     VARCHAR(64) NOT NULL,
  setting_value   TEXT NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_workspace_settings_ws
  ON public.workspace_settings (workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_settings_key
  ON public.workspace_settings (setting_key);

COMMENT ON TABLE public.workspace_settings IS
  'Sprint 50 — Workspace configuration settings (member RLS).';

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_settings' AND policyname = 'workspace_settings_ws_select') THEN
    EXECUTE 'CREATE POLICY workspace_settings_ws_select ON public.workspace_settings FOR SELECT USING (public.current_user_in_workspace(workspace_id) OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_settings' AND policyname = 'workspace_settings_ws_write') THEN
    EXECUTE 'CREATE POLICY workspace_settings_ws_write ON public.workspace_settings FOR ALL USING (public.current_user_can_write_workspace(workspace_id)) WITH CHECK (public.current_user_can_write_workspace(workspace_id))';
  END IF;
END $$;

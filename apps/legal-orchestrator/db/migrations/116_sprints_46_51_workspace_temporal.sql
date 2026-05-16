-- =====================================================================
-- 116_sprints_46_51_workspace_temporal.sql
-- =====================================================================
-- Sprints 46–51: temporal validity window per case + access audit log.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.case_record_temporal_scope (
  case_id         UUID PRIMARY KEY REFERENCES public.legal_case_records(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_case_record_temporal_scope_workspace
  ON public.case_record_temporal_scope (workspace_id);

CREATE TABLE IF NOT EXISTS public.workspace_case_access_audit (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  case_id             UUID NOT NULL REFERENCES public.legal_case_records(id) ON DELETE CASCADE,
  accessor_user_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  accessed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_fingerprint  TEXT
);

CREATE INDEX IF NOT EXISTS idx_workspace_case_access_audit_case
  ON public.workspace_case_access_audit (case_id, accessed_at DESC);

ALTER TABLE public.case_record_temporal_scope ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_case_access_audit ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'case_record_temporal_scope' AND policyname = 'case_record_temporal_scope_ws_select') THEN
    EXECUTE 'CREATE POLICY case_record_temporal_scope_ws_select ON public.case_record_temporal_scope FOR SELECT USING (public.current_user_in_workspace(workspace_id) OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'case_record_temporal_scope' AND policyname = 'case_record_temporal_scope_ws_write') THEN
    EXECUTE 'CREATE POLICY case_record_temporal_scope_ws_write ON public.case_record_temporal_scope FOR ALL USING (public.current_user_can_write_case(workspace_id, (SELECT r.assigned_user_id FROM public.legal_case_records r WHERE r.id = case_id))) WITH CHECK (public.current_user_can_write_case(workspace_id, (SELECT r.assigned_user_id FROM public.legal_case_records r WHERE r.id = case_id)))';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_case_access_audit' AND policyname = 'workspace_case_access_audit_ws_select') THEN
    EXECUTE 'CREATE POLICY workspace_case_access_audit_ws_select ON public.workspace_case_access_audit FOR SELECT USING (public.current_user_in_workspace(workspace_id) OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_case_access_audit' AND policyname = 'workspace_case_access_audit_ws_insert') THEN
    EXECUTE 'CREATE POLICY workspace_case_access_audit_ws_insert ON public.workspace_case_access_audit FOR INSERT WITH CHECK (accessor_user_id = public.current_app_user_id() AND public.current_user_in_workspace(workspace_id))';
  END IF;
END $$;

-- =====================================================================
-- 120_sprint24_law_engine_phase4.sql
-- =====================================================================
-- Sprint 24 — Law Module Engine Phase 4: compliance checklist audit
-- (anonymized payload + Zone 2 stub checklist JSON).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.law_engine_phase4_checklist_audit (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id              UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  situation_fingerprint     TEXT NOT NULL,
  risk_band                 TEXT NOT NULL CHECK (risk_band IN ('LOW', 'MEDIUM', 'HIGH')),
  anonymized_payload        JSONB NOT NULL,
  zone2_stub_checklist      JSONB NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_law_engine_phase4_checklist_user_created
  ON public.law_engine_phase4_checklist_audit (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_law_engine_phase4_checklist_workspace
  ON public.law_engine_phase4_checklist_audit (workspace_id, created_at DESC);

COMMENT ON TABLE public.law_engine_phase4_checklist_audit IS
  'Sprint 24 — Zone 2 compliance checklist stub audit.';

ALTER TABLE public.law_engine_phase4_checklist_audit ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'law_engine_phase4_checklist_audit' AND policyname = 'law_engine_phase4_checklist_self_select') THEN
    EXECUTE 'CREATE POLICY law_engine_phase4_checklist_self_select ON public.law_engine_phase4_checklist_audit FOR SELECT USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'law_engine_phase4_checklist_audit' AND policyname = 'law_engine_phase4_checklist_self_insert') THEN
    EXECUTE 'CREATE POLICY law_engine_phase4_checklist_self_insert ON public.law_engine_phase4_checklist_audit FOR INSERT WITH CHECK (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'law_engine_phase4_checklist_audit' AND policyname = 'law_engine_phase4_checklist_admin_delete') THEN
    EXECUTE 'CREATE POLICY law_engine_phase4_checklist_admin_delete ON public.law_engine_phase4_checklist_audit FOR DELETE USING (public.current_app_user_is_admin())';
  END IF;
END $$;

-- =====================================================================
-- 119_sprint23_law_engine_phase3.sql
-- =====================================================================
-- Sprint 23 — Law Module Engine Phase 3: refinement / risk-band audit
-- (anonymized payload + Zone 2 stub refinement JSON).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.law_engine_phase3_refinement_audit (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id              UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  situation_fingerprint     TEXT NOT NULL,
  fused_score               DOUBLE PRECISION NOT NULL,
  risk_band                 TEXT NOT NULL CHECK (risk_band IN ('LOW', 'MEDIUM', 'HIGH')),
  anonymized_payload        JSONB NOT NULL,
  zone2_stub_refinement     JSONB NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_law_engine_phase3_refinement_user_created
  ON public.law_engine_phase3_refinement_audit (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_law_engine_phase3_refinement_workspace
  ON public.law_engine_phase3_refinement_audit (workspace_id, created_at DESC);

COMMENT ON TABLE public.law_engine_phase3_refinement_audit IS
  'Sprint 23 — Zone 2 law refinement stub audit (risk band + refinement payload).';

ALTER TABLE public.law_engine_phase3_refinement_audit ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'law_engine_phase3_refinement_audit' AND policyname = 'law_engine_phase3_refinement_self_select') THEN
    EXECUTE 'CREATE POLICY law_engine_phase3_refinement_self_select ON public.law_engine_phase3_refinement_audit FOR SELECT USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'law_engine_phase3_refinement_audit' AND policyname = 'law_engine_phase3_refinement_self_insert') THEN
    EXECUTE 'CREATE POLICY law_engine_phase3_refinement_self_insert ON public.law_engine_phase3_refinement_audit FOR INSERT WITH CHECK (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'law_engine_phase3_refinement_audit' AND policyname = 'law_engine_phase3_refinement_admin_delete') THEN
    EXECUTE 'CREATE POLICY law_engine_phase3_refinement_admin_delete ON public.law_engine_phase3_refinement_audit FOR DELETE USING (public.current_app_user_is_admin())';
  END IF;
END $$;

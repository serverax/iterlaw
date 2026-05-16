-- =====================================================================
-- 118_sprint22_law_engine_zone2_analysis.sql
-- =====================================================================
-- Sprint 22 — Law Module Engine Phase 2: audit rows for anonymized Zone 2
-- law-analysis requests (stub responses until Zone 2 is live).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.law_engine_zone2_analysis (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id              UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  situation_fingerprint     TEXT NOT NULL,
  anonymized_payload        JSONB NOT NULL,
  zone2_stub_response       JSONB NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_law_engine_zone2_analysis_user_created
  ON public.law_engine_zone2_analysis (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_law_engine_zone2_analysis_workspace
  ON public.law_engine_zone2_analysis (workspace_id, created_at DESC);

COMMENT ON TABLE public.law_engine_zone2_analysis IS
  'Sprint 22 — Zone 2 law analysis audit (anonymized payload + stub response).';

ALTER TABLE public.law_engine_zone2_analysis ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'law_engine_zone2_analysis' AND policyname = 'law_engine_zone2_analysis_self_select') THEN
    EXECUTE 'CREATE POLICY law_engine_zone2_analysis_self_select ON public.law_engine_zone2_analysis FOR SELECT USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'law_engine_zone2_analysis' AND policyname = 'law_engine_zone2_analysis_self_insert') THEN
    EXECUTE 'CREATE POLICY law_engine_zone2_analysis_self_insert ON public.law_engine_zone2_analysis FOR INSERT WITH CHECK (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'law_engine_zone2_analysis' AND policyname = 'law_engine_zone2_analysis_admin_delete') THEN
    EXECUTE 'CREATE POLICY law_engine_zone2_analysis_admin_delete ON public.law_engine_zone2_analysis FOR DELETE USING (public.current_app_user_is_admin())';
  END IF;
END $$;

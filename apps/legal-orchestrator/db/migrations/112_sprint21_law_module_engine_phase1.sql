-- =====================================================================
-- 112_sprint21_law_module_engine_phase1.sql
-- =====================================================================
-- Sprint 21 — Law Module Engine Phase 1: persisted run metadata (audit).
--
-- RLS: owner read/insert; admin update/delete (processing queue).
-- Idempotent.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.law_module_engine_runs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  module_id               TEXT NOT NULL,
  calculator_id           TEXT,
  input_fingerprint       TEXT NOT NULL,
  evidence_pack_version   INT NOT NULL DEFAULT 1 CHECK (evidence_pack_version > 0),
  result_summary          JSONB NOT NULL DEFAULT '{}'::jsonb,
  reranker_score          NUMERIC,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_law_module_engine_runs_user_created
  ON public.law_module_engine_runs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_law_module_engine_runs_calculator
  ON public.law_module_engine_runs (calculator_id, created_at DESC);

COMMENT ON TABLE public.law_module_engine_runs IS
  'Law Module Engine phase-1 run audit (Sprint 21).';

ALTER TABLE public.law_module_engine_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'law_module_engine_runs' AND policyname = 'law_module_engine_runs_self_select') THEN
    EXECUTE 'CREATE POLICY law_module_engine_runs_self_select ON public.law_module_engine_runs FOR SELECT USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'law_module_engine_runs' AND policyname = 'law_module_engine_runs_self_insert') THEN
    EXECUTE 'CREATE POLICY law_module_engine_runs_self_insert ON public.law_module_engine_runs FOR INSERT WITH CHECK (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'law_module_engine_runs' AND policyname = 'law_module_engine_runs_admin_update') THEN
    EXECUTE 'CREATE POLICY law_module_engine_runs_admin_update ON public.law_module_engine_runs FOR UPDATE USING (public.current_app_user_is_admin()) WITH CHECK (public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'law_module_engine_runs' AND policyname = 'law_module_engine_runs_admin_delete') THEN
    EXECUTE 'CREATE POLICY law_module_engine_runs_admin_delete ON public.law_module_engine_runs FOR DELETE USING (public.current_app_user_is_admin())';
  END IF;
END $$;

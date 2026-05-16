-- =====================================================================
-- 113_sprints_22_25_law_engine.sql
-- =====================================================================
-- Sprints 22–25: calculator fusion audit, reranker calibration log,
-- evidence chain edges (case ↔ legislation/policy graph).
-- RLS: workspace-scoped rows use current_user_in_workspace; calibration admin-only.
-- Idempotent.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.law_module_calculator_fusion_runs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id            UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_calculator_ids   TEXT[] NOT NULL,
  fused_input_fingerprint TEXT NOT NULL,
  result_summary          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_law_module_calculator_fusion_workspace
  ON public.law_module_calculator_fusion_runs (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.law_module_reranker_calibration (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version     TEXT NOT NULL,
  ce_loss           NUMERIC NOT NULL,
  calibration_epoch INT NOT NULL CHECK (calibration_epoch >= 0),
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_law_module_reranker_calibration_model
  ON public.law_module_reranker_calibration (model_version, recorded_at DESC);

CREATE TABLE IF NOT EXISTS public.evidence_chain_edges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  case_id         UUID NOT NULL REFERENCES public.legal_case_records(id) ON DELETE CASCADE,
  source_node_id  TEXT NOT NULL,
  target_node_id  TEXT NOT NULL,
  edge_kind       TEXT NOT NULL CHECK (edge_kind IN ('CITES', 'SUPERSEDES', 'IMPLEMENTS', 'RELATES')),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_chain_edges_case
  ON public.evidence_chain_edges (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_chain_edges_source_trgm
  ON public.evidence_chain_edges USING gin (source_node_id gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_evidence_chain_edges_target_trgm
  ON public.evidence_chain_edges USING gin (target_node_id gin_trgm_ops);

ALTER TABLE public.law_module_calculator_fusion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.law_module_reranker_calibration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_chain_edges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'law_module_calculator_fusion_runs' AND policyname = 'law_module_calculator_fusion_runs_ws_select') THEN
    EXECUTE 'CREATE POLICY law_module_calculator_fusion_runs_ws_select ON public.law_module_calculator_fusion_runs FOR SELECT USING (public.current_user_in_workspace(workspace_id) OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'law_module_calculator_fusion_runs' AND policyname = 'law_module_calculator_fusion_runs_ws_insert') THEN
    EXECUTE 'CREATE POLICY law_module_calculator_fusion_runs_ws_insert ON public.law_module_calculator_fusion_runs FOR INSERT WITH CHECK (user_id = public.current_app_user_id() AND public.current_user_in_workspace(workspace_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'law_module_calculator_fusion_runs' AND policyname = 'law_module_calculator_fusion_runs_admin_all') THEN
    EXECUTE 'CREATE POLICY law_module_calculator_fusion_runs_admin_all ON public.law_module_calculator_fusion_runs FOR ALL USING (public.current_app_user_is_admin()) WITH CHECK (public.current_app_user_is_admin())';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'law_module_reranker_calibration' AND policyname = 'law_module_reranker_calibration_admin_all') THEN
    EXECUTE 'CREATE POLICY law_module_reranker_calibration_admin_all ON public.law_module_reranker_calibration FOR ALL USING (public.current_app_user_is_admin()) WITH CHECK (public.current_app_user_is_admin())';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'evidence_chain_edges' AND policyname = 'evidence_chain_edges_ws_select') THEN
    EXECUTE 'CREATE POLICY evidence_chain_edges_ws_select ON public.evidence_chain_edges FOR SELECT USING (public.current_user_in_workspace(workspace_id) OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'evidence_chain_edges' AND policyname = 'evidence_chain_edges_ws_mutate') THEN
    EXECUTE 'CREATE POLICY evidence_chain_edges_ws_mutate ON public.evidence_chain_edges FOR INSERT WITH CHECK (public.current_user_in_workspace(workspace_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'evidence_chain_edges' AND policyname = 'evidence_chain_edges_ws_update') THEN
    EXECUTE 'CREATE POLICY evidence_chain_edges_ws_update ON public.evidence_chain_edges FOR UPDATE USING (public.current_user_in_workspace(workspace_id)) WITH CHECK (public.current_user_in_workspace(workspace_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'evidence_chain_edges' AND policyname = 'evidence_chain_edges_ws_delete') THEN
    EXECUTE 'CREATE POLICY evidence_chain_edges_ws_delete ON public.evidence_chain_edges FOR DELETE USING (public.current_user_in_workspace(workspace_id) OR public.current_app_user_is_admin())';
  END IF;
END $$;

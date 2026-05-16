-- =====================================================================
-- 154_sprint58_document_intel_integration.sql
-- =====================================================================
-- Sprint 58 — Document intelligence pipeline integration markers.
-- PREP: fill implementation after UAT sign-off.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.document_intel_pipeline_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id           UUID NOT NULL REFERENCES public.document_uploads(id) ON DELETE CASCADE,
  pipeline_version    VARCHAR(32) NOT NULL DEFAULT 'sprint58-v1',
  stage               TEXT NOT NULL CHECK (stage IN (
    'upload', 'ocr', 'entities', 'parse', 'classify', 'chunk', 'embed', 'search', 'answer', 'complete'
  )),
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
  latency_ms          INT CHECK (latency_ms IS NULL OR latency_ms >= 0),
  error_message       TEXT,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_intel_pipeline_upload
  ON public.document_intel_pipeline_runs (upload_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_document_intel_pipeline_stage
  ON public.document_intel_pipeline_runs (stage, status);

ALTER TABLE public.document_intel_pipeline_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_intel_pipeline_runs' AND policyname = 'document_intel_pipeline_ws_select') THEN
    EXECUTE 'CREATE POLICY document_intel_pipeline_ws_select ON public.document_intel_pipeline_runs FOR SELECT USING (EXISTS (SELECT 1 FROM public.document_uploads u WHERE u.id = upload_id AND (public.current_user_in_workspace(u.workspace_id) OR public.current_app_user_is_admin())))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_intel_pipeline_runs' AND policyname = 'document_intel_pipeline_ws_write') THEN
    EXECUTE 'CREATE POLICY document_intel_pipeline_ws_write ON public.document_intel_pipeline_runs FOR ALL USING (EXISTS (SELECT 1 FROM public.document_uploads u WHERE u.id = upload_id AND public.current_user_can_write_workspace(u.workspace_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.document_uploads u WHERE u.id = upload_id AND public.current_user_can_write_workspace(u.workspace_id)))';
  END IF;
END $$;

COMMENT ON TABLE public.document_intel_pipeline_runs IS
  'Sprint 58 — End-to-end document intelligence pipeline run log.';

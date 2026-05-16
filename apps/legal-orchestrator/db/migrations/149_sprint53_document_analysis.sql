-- =====================================================================
-- 149_sprint53_document_analysis.sql
-- =====================================================================
-- Sprint 53 — Legal document parsing (employment letters, notices).
-- PREP: fill implementation after UAT sign-off.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.document_analysis (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id           UUID NOT NULL REFERENCES public.document_uploads(id) ON DELETE CASCADE,
  document_type       VARCHAR(100),
  parsed_data         JSONB NOT NULL DEFAULT '{}'::jsonb,
  issue_date          DATE,
  effective_date      DATE,
  reason              TEXT,
  appeal_deadline     DATE,
  issues_identified   JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_score    NUMERIC(3,2) CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  analyzed_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_analysis_upload
  ON public.document_analysis (upload_id);

CREATE INDEX IF NOT EXISTS idx_document_analysis_type
  ON public.document_analysis (document_type);

ALTER TABLE public.document_analysis ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_analysis' AND policyname = 'document_analysis_ws_select') THEN
    EXECUTE 'CREATE POLICY document_analysis_ws_select ON public.document_analysis FOR SELECT USING (EXISTS (SELECT 1 FROM public.document_uploads u WHERE u.id = upload_id AND (public.current_user_in_workspace(u.workspace_id) OR public.current_app_user_is_admin())))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_analysis' AND policyname = 'document_analysis_ws_write') THEN
    EXECUTE 'CREATE POLICY document_analysis_ws_write ON public.document_analysis FOR ALL USING (EXISTS (SELECT 1 FROM public.document_uploads u WHERE u.id = upload_id AND public.current_user_can_write_workspace(u.workspace_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.document_uploads u WHERE u.id = upload_id AND public.current_user_can_write_workspace(u.workspace_id)))';
  END IF;
END $$;

COMMENT ON TABLE public.document_analysis IS
  'Sprint 53 — Structured legal document parse results.';

-- =====================================================================
-- 150_sprint54_document_metadata.sql
-- =====================================================================
-- Sprint 54 — Document classification and case linkage metadata.
-- PREP: fill implementation after UAT sign-off.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.document_metadata (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id             UUID NOT NULL REFERENCES public.document_uploads(id) ON DELETE CASCADE,
  primary_category      VARCHAR(100),
  sub_category            VARCHAR(100),
  legal_relevance_score   NUMERIC(3,2) CHECK (legal_relevance_score IS NULL OR (legal_relevance_score >= 0 AND legal_relevance_score <= 1)),
  urgency               VARCHAR(20) CHECK (urgency IS NULL OR urgency IN ('high', 'medium', 'low')),
  actions_required      JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_case_id        UUID REFERENCES public.legal_case_records(id) ON DELETE SET NULL,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  classified_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_metadata_upload
  ON public.document_metadata (upload_id);

CREATE INDEX IF NOT EXISTS idx_document_metadata_case
  ON public.document_metadata (linked_case_id)
  WHERE linked_case_id IS NOT NULL;

ALTER TABLE public.document_metadata ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_metadata' AND policyname = 'document_metadata_ws_select') THEN
    EXECUTE 'CREATE POLICY document_metadata_ws_select ON public.document_metadata FOR SELECT USING (EXISTS (SELECT 1 FROM public.document_uploads u WHERE u.id = upload_id AND (public.current_user_in_workspace(u.workspace_id) OR public.current_app_user_is_admin())))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_metadata' AND policyname = 'document_metadata_ws_write') THEN
    EXECUTE 'CREATE POLICY document_metadata_ws_write ON public.document_metadata FOR ALL USING (EXISTS (SELECT 1 FROM public.document_uploads u WHERE u.id = upload_id AND public.current_user_can_write_workspace(u.workspace_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.document_uploads u WHERE u.id = upload_id AND public.current_user_can_write_workspace(u.workspace_id)))';
  END IF;
END $$;

COMMENT ON TABLE public.document_metadata IS
  'Sprint 54 — Document classification and metadata.';

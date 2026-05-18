-- =====================================================================
-- 153_sprint57_cited_answers.sql
-- =====================================================================
-- Sprint 57 — Citation-locked answer synthesis storage.
-- PREP: fill implementation after UAT sign-off.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.cited_answers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  upload_id           UUID REFERENCES public.document_uploads(id) ON DELETE SET NULL,
  question            TEXT NOT NULL,
  answer_text         TEXT NOT NULL,
  law_section           TEXT,
  meaning               TEXT,
  action                TEXT,
  citation_data         JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_score      NUMERIC(3,2) CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cited_answers_user_ts
  ON public.cited_answers (user_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_cited_answers_upload
  ON public.cited_answers (upload_id)
  WHERE upload_id IS NOT NULL;

ALTER TABLE public.cited_answers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cited_answers' AND policyname = 'cited_answers_owner_select') THEN
    EXECUTE 'CREATE POLICY cited_answers_owner_select ON public.cited_answers FOR SELECT USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cited_answers' AND policyname = 'cited_answers_owner_insert') THEN
    EXECUTE 'CREATE POLICY cited_answers_owner_insert ON public.cited_answers FOR INSERT WITH CHECK (user_id = public.current_app_user_id())';
  END IF;
END $$;

COMMENT ON TABLE public.cited_answers IS
  'Sprint 57 — LAW / MEANING / ACTION answers with locked citations.';

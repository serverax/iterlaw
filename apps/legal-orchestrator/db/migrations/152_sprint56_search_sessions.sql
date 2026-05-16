-- =====================================================================
-- 152_sprint56_search_sessions.sql
-- =====================================================================
-- Sprint 56 — Semantic search session tracking.
-- PREP: fill implementation after UAT sign-off.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.search_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  upload_id           UUID REFERENCES public.document_uploads(id) ON DELETE SET NULL,
  query               TEXT NOT NULL,
  results_returned    INT NOT NULL DEFAULT 0 CHECK (results_returned >= 0),
  timestamp           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_sessions_user_ts
  ON public.search_sessions (user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_search_sessions_upload
  ON public.search_sessions (upload_id)
  WHERE upload_id IS NOT NULL;

ALTER TABLE public.search_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'search_sessions' AND policyname = 'search_sessions_owner_select') THEN
    EXECUTE 'CREATE POLICY search_sessions_owner_select ON public.search_sessions FOR SELECT USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'search_sessions' AND policyname = 'search_sessions_owner_insert') THEN
    EXECUTE 'CREATE POLICY search_sessions_owner_insert ON public.search_sessions FOR INSERT WITH CHECK (user_id = public.current_app_user_id())';
  END IF;
END $$;

COMMENT ON TABLE public.search_sessions IS
  'Sprint 56 — Vector search / RAG session audit log.';

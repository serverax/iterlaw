-- =====================================================================
-- 128_sprint32_retrieval_batch_query_jobs.sql
-- =====================================================================
-- Sprint 32 — Batch retrieval job queue (user-scoped).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.retrieval_batch_query_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  batch_size    INT NOT NULL CHECK (batch_size > 0),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  status        TEXT NOT NULL CHECK (status IN ('queued', 'running', 'done', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_retrieval_batch_jobs_user
  ON public.retrieval_batch_query_jobs (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_retrieval_batch_jobs_status
  ON public.retrieval_batch_query_jobs (status, started_at DESC);

COMMENT ON TABLE public.retrieval_batch_query_jobs IS
  'Sprint 32 — batch query job lifecycle (user-scoped RLS).';

ALTER TABLE public.retrieval_batch_query_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'retrieval_batch_query_jobs' AND policyname = 'retrieval_batch_jobs_self_select') THEN
    EXECUTE 'CREATE POLICY retrieval_batch_jobs_self_select ON public.retrieval_batch_query_jobs FOR SELECT USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'retrieval_batch_query_jobs' AND policyname = 'retrieval_batch_jobs_self_insert') THEN
    EXECUTE 'CREATE POLICY retrieval_batch_jobs_self_insert ON public.retrieval_batch_query_jobs FOR INSERT WITH CHECK (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'retrieval_batch_query_jobs' AND policyname = 'retrieval_batch_jobs_self_update') THEN
    EXECUTE 'CREATE POLICY retrieval_batch_jobs_self_update ON public.retrieval_batch_query_jobs FOR UPDATE USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin()) WITH CHECK (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'retrieval_batch_query_jobs' AND policyname = 'retrieval_batch_jobs_admin_delete') THEN
    EXECUTE 'CREATE POLICY retrieval_batch_jobs_admin_delete ON public.retrieval_batch_query_jobs FOR DELETE USING (public.current_app_user_is_admin())';
  END IF;
END $$;

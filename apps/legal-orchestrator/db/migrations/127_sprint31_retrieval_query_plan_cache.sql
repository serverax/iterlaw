-- =====================================================================
-- 127_sprint31_retrieval_query_plan_cache.sql
-- =====================================================================
-- Sprint 31 — Cached query plans (admin-only).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.retrieval_query_plan_cache (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_fingerprint  TEXT NOT NULL,
  execution_plan     JSONB NOT NULL,
  est_rows           BIGINT NOT NULL CHECK (est_rows >= 0),
  actual_rows        BIGINT NOT NULL CHECK (actual_rows >= 0),
  plan_created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retrieval_query_plan_fingerprint
  ON public.retrieval_query_plan_cache (query_fingerprint);

COMMENT ON TABLE public.retrieval_query_plan_cache IS
  'Sprint 31 — query plan fingerprint cache (admin RLS).';

ALTER TABLE public.retrieval_query_plan_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'retrieval_query_plan_cache'
      AND policyname = 'retrieval_query_plan_cache_admin_all'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY retrieval_query_plan_cache_admin_all
      ON public.retrieval_query_plan_cache
      FOR ALL
      USING (public.current_app_user_is_admin())
      WITH CHECK (public.current_app_user_is_admin())
    $pol$;
  END IF;
END $$;

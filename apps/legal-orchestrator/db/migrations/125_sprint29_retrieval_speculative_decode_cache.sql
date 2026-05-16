-- =====================================================================
-- 125_sprint29_retrieval_speculative_decode_cache.sql
-- =====================================================================
-- Sprint 29 — Speculative decode cache (admin-only observability layer).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.retrieval_speculative_decode_cache (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash        TEXT NOT NULL,
  draft_tokens      JSONB NOT NULL,
  verifier_tokens   JSONB NOT NULL,
  acceptance_rate   DOUBLE PRECISION NOT NULL CHECK (acceptance_rate >= 0 AND acceptance_rate <= 1),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retrieval_speculative_query_hash
  ON public.retrieval_speculative_decode_cache (query_hash);

CREATE INDEX IF NOT EXISTS idx_retrieval_speculative_acceptance
  ON public.retrieval_speculative_decode_cache (acceptance_rate);

COMMENT ON TABLE public.retrieval_speculative_decode_cache IS
  'Sprint 29 — speculative draft/verifier token cache (admin RLS).';

ALTER TABLE public.retrieval_speculative_decode_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'retrieval_speculative_decode_cache'
      AND policyname = 'retrieval_speculative_decode_cache_admin_all'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY retrieval_speculative_decode_cache_admin_all
      ON public.retrieval_speculative_decode_cache
      FOR ALL
      USING (public.current_app_user_is_admin())
      WITH CHECK (public.current_app_user_is_admin())
    $pol$;
  END IF;
END $$;

-- =====================================================================
-- 129_sprint33_retrieval_cache_invalidation_rules.sql
-- =====================================================================
-- Sprint 33 — Cache invalidation rules (admin-only).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.retrieval_cache_invalidation_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern               TEXT NOT NULL,
  ttl_seconds           INT NOT NULL CHECK (ttl_seconds > 0),
  trigger_on            TEXT NOT NULL,
  last_invalidated_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_retrieval_cache_invalidation_pattern
  ON public.retrieval_cache_invalidation_rules (pattern);

CREATE INDEX IF NOT EXISTS idx_retrieval_cache_invalidation_trigger
  ON public.retrieval_cache_invalidation_rules (trigger_on);

COMMENT ON TABLE public.retrieval_cache_invalidation_rules IS
  'Sprint 33 — retrieval cache invalidation patterns (admin RLS).';

ALTER TABLE public.retrieval_cache_invalidation_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'retrieval_cache_invalidation_rules'
      AND policyname = 'retrieval_cache_invalidation_rules_admin_all'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY retrieval_cache_invalidation_rules_admin_all
      ON public.retrieval_cache_invalidation_rules
      FOR ALL
      USING (public.current_app_user_is_admin())
      WITH CHECK (public.current_app_user_is_admin())
    $pol$;
  END IF;
END $$;

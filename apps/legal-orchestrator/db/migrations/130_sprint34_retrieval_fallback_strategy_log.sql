-- =====================================================================
-- 130_sprint34_retrieval_fallback_strategy_log.sql
-- =====================================================================
-- Sprint 34 — Retrieval fallback strategy audit log (member-scoped RLS).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.retrieval_fallback_strategy_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id           UUID NOT NULL,
  primary_strategy   TEXT NOT NULL,
  fallback_strategy  TEXT NOT NULL,
  reason             TEXT NOT NULL,
  executed_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retrieval_fallback_log_query
  ON public.retrieval_fallback_strategy_log (query_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_retrieval_fallback_log_primary
  ON public.retrieval_fallback_strategy_log (primary_strategy, executed_at DESC);

COMMENT ON TABLE public.retrieval_fallback_strategy_log IS
  'Sprint 34 — fallback chain events (authenticated member RLS).';

ALTER TABLE public.retrieval_fallback_strategy_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'retrieval_fallback_strategy_log' AND policyname = 'retrieval_fallback_log_member_select') THEN
    EXECUTE 'CREATE POLICY retrieval_fallback_log_member_select ON public.retrieval_fallback_strategy_log FOR SELECT USING (public.current_app_user_id() IS NOT NULL OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'retrieval_fallback_strategy_log' AND policyname = 'retrieval_fallback_log_member_insert') THEN
    EXECUTE 'CREATE POLICY retrieval_fallback_log_member_insert ON public.retrieval_fallback_strategy_log FOR INSERT WITH CHECK (public.current_app_user_id() IS NOT NULL OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'retrieval_fallback_strategy_log' AND policyname = 'retrieval_fallback_log_admin_delete') THEN
    EXECUTE 'CREATE POLICY retrieval_fallback_log_admin_delete ON public.retrieval_fallback_strategy_log FOR DELETE USING (public.current_app_user_is_admin())';
  END IF;
END $$;

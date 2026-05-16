-- =====================================================================
-- 126_sprint30_retrieval_latency_metrics.sql
-- =====================================================================
-- Sprint 30 — Latency percentile + SLA snapshots (admin-only).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.retrieval_latency_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id        UUID NOT NULL,
  p50_ms          DOUBLE PRECISION NOT NULL CHECK (p50_ms >= 0),
  p99_ms          DOUBLE PRECISION NOT NULL CHECK (p99_ms >= 0),
  p999_ms         DOUBLE PRECISION NOT NULL CHECK (p999_ms >= 0),
  sla_target_ms   DOUBLE PRECISION NOT NULL CHECK (sla_target_ms > 0),
  sla_met         BOOLEAN NOT NULL,
  measured_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retrieval_latency_measured
  ON public.retrieval_latency_metrics (measured_at DESC);

CREATE INDEX IF NOT EXISTS idx_retrieval_latency_sla_met
  ON public.retrieval_latency_metrics (sla_met, measured_at DESC);

COMMENT ON TABLE public.retrieval_latency_metrics IS
  'Sprint 30 — retrieval latency percentiles vs SLA (admin RLS).';

ALTER TABLE public.retrieval_latency_metrics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'retrieval_latency_metrics'
      AND policyname = 'retrieval_latency_metrics_admin_all'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY retrieval_latency_metrics_admin_all
      ON public.retrieval_latency_metrics
      FOR ALL
      USING (public.current_app_user_is_admin())
      WITH CHECK (public.current_app_user_is_admin())
    $pol$;
  END IF;
END $$;

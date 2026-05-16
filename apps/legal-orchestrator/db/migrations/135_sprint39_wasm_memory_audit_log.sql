-- =====================================================================
-- 135_sprint39_wasm_memory_audit_log.sql
-- =====================================================================
-- Sprint 39 — WASM memory / gas audit log (admin-only).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.wasm_memory_audit_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id          UUID NOT NULL,
  memory_allocated_kb   INT NOT NULL CHECK (memory_allocated_kb >= 0),
  memory_peak_kb        INT NOT NULL CHECK (memory_peak_kb >= 0),
  oom_triggered         BOOLEAN NOT NULL,
  audited_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wasm_memory_audit_execution
  ON public.wasm_memory_audit_log (execution_id, audited_at DESC);

CREATE INDEX IF NOT EXISTS idx_wasm_memory_audit_oom
  ON public.wasm_memory_audit_log (oom_triggered, audited_at DESC);

COMMENT ON TABLE public.wasm_memory_audit_log IS
  'Sprint 39 — WASM memory enforcement audit (admin RLS).';

ALTER TABLE public.wasm_memory_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'wasm_memory_audit_log'
      AND policyname = 'wasm_memory_audit_log_admin_all'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY wasm_memory_audit_log_admin_all
      ON public.wasm_memory_audit_log
      FOR ALL
      USING (public.current_app_user_is_admin())
      WITH CHECK (public.current_app_user_is_admin())
    $pol$;
  END IF;
END $$;

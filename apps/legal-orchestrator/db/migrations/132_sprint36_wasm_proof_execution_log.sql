-- =====================================================================
-- 132_sprint36_wasm_proof_execution_log.sql
-- =====================================================================
-- Sprint 36 — WASM proof execution audit log (admin-only).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.wasm_proof_execution_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proof_id        UUID NOT NULL,
  execution_hash  TEXT NOT NULL,
  result_hash     TEXT NOT NULL,
  gas_used        INT NOT NULL CHECK (gas_used >= 0),
  verified_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wasm_proof_log_proof_id
  ON public.wasm_proof_execution_log (proof_id, verified_at DESC);

CREATE INDEX IF NOT EXISTS idx_wasm_proof_log_verified_at
  ON public.wasm_proof_execution_log (verified_at DESC);

COMMENT ON TABLE public.wasm_proof_execution_log IS
  'Sprint 36 — deterministic WASM proof verification audit (admin RLS).';

ALTER TABLE public.wasm_proof_execution_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'wasm_proof_execution_log'
      AND policyname = 'wasm_proof_execution_log_admin_all'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY wasm_proof_execution_log_admin_all
      ON public.wasm_proof_execution_log
      FOR ALL
      USING (public.current_app_user_is_admin())
      WITH CHECK (public.current_app_user_is_admin())
    $pol$;
  END IF;
END $$;

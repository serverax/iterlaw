-- =====================================================================
-- 137_sprint41_wasm_zkp_statement_log.sql
-- =====================================================================
-- Sprint 41 — ZKP statement verification log (user-scoped).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.wasm_zkp_statement_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  statement_hash    TEXT NOT NULL,
  proof_hash        TEXT NOT NULL,
  prover_public_key TEXT NOT NULL,
  verified_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wasm_zkp_user
  ON public.wasm_zkp_statement_log (user_id, verified_at DESC);

CREATE INDEX IF NOT EXISTS idx_wasm_zkp_statement
  ON public.wasm_zkp_statement_log (statement_hash);

CREATE INDEX IF NOT EXISTS idx_wasm_zkp_verified_at
  ON public.wasm_zkp_statement_log (verified_at DESC);

COMMENT ON TABLE public.wasm_zkp_statement_log IS
  'Sprint 41 — WASM zero-knowledge proof verification log (user RLS).';

ALTER TABLE public.wasm_zkp_statement_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wasm_zkp_statement_log' AND policyname = 'wasm_zkp_statement_log_self_select') THEN
    EXECUTE 'CREATE POLICY wasm_zkp_statement_log_self_select ON public.wasm_zkp_statement_log FOR SELECT USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wasm_zkp_statement_log' AND policyname = 'wasm_zkp_statement_log_self_insert') THEN
    EXECUTE 'CREATE POLICY wasm_zkp_statement_log_self_insert ON public.wasm_zkp_statement_log FOR INSERT WITH CHECK (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
END $$;

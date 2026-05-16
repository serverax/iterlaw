-- =====================================================================
-- 133_sprint37_wasm_client_proof_cache.sql
-- =====================================================================
-- Sprint 37 — Client-side proof cache (user-scoped).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.wasm_client_proof_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  proof_hash    TEXT NOT NULL,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wasm_client_proof_user
  ON public.wasm_client_proof_cache (user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_wasm_client_proof_hash
  ON public.wasm_client_proof_cache (proof_hash);

COMMENT ON TABLE public.wasm_client_proof_cache IS
  'Sprint 37 — WASM client proof cache (user RLS).';

ALTER TABLE public.wasm_client_proof_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wasm_client_proof_cache' AND policyname = 'wasm_client_proof_cache_self_select') THEN
    EXECUTE 'CREATE POLICY wasm_client_proof_cache_self_select ON public.wasm_client_proof_cache FOR SELECT USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wasm_client_proof_cache' AND policyname = 'wasm_client_proof_cache_self_insert') THEN
    EXECUTE 'CREATE POLICY wasm_client_proof_cache_self_insert ON public.wasm_client_proof_cache FOR INSERT WITH CHECK (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wasm_client_proof_cache' AND policyname = 'wasm_client_proof_cache_admin_delete') THEN
    EXECUTE 'CREATE POLICY wasm_client_proof_cache_admin_delete ON public.wasm_client_proof_cache FOR DELETE USING (public.current_app_user_is_admin())';
  END IF;
END $$;

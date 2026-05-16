-- =====================================================================
-- 115_sprints_35_45_wasm_intel.sql
-- =====================================================================
-- Sprints 35–45: WASM module catalog + client proof cache (TTL).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.wasm_module_registry (
  module_id       TEXT NOT NULL,
  version         TEXT NOT NULL,
  sha256_hex      TEXT NOT NULL,
  memory_limit_mb INT NOT NULL CHECK (memory_limit_mb > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wasm_module_registry_pk PRIMARY KEY (module_id, version)
);

CREATE TABLE IF NOT EXISTS public.client_proof_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  proof_blob_ref  TEXT NOT NULL,
  verified        BOOLEAN NOT NULL DEFAULT false,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_proof_cache_user_expires
  ON public.client_proof_cache (user_id, expires_at);

ALTER TABLE public.wasm_module_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_proof_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wasm_module_registry' AND policyname = 'wasm_module_registry_admin_all') THEN
    EXECUTE 'CREATE POLICY wasm_module_registry_admin_all ON public.wasm_module_registry FOR ALL USING (public.current_app_user_is_admin()) WITH CHECK (public.current_app_user_is_admin())';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'client_proof_cache' AND policyname = 'client_proof_cache_self_select') THEN
    EXECUTE 'CREATE POLICY client_proof_cache_self_select ON public.client_proof_cache FOR SELECT USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'client_proof_cache' AND policyname = 'client_proof_cache_self_insert') THEN
    EXECUTE 'CREATE POLICY client_proof_cache_self_insert ON public.client_proof_cache FOR INSERT WITH CHECK (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'client_proof_cache' AND policyname = 'client_proof_cache_admin_delete') THEN
    EXECUTE 'CREATE POLICY client_proof_cache_admin_delete ON public.client_proof_cache FOR DELETE USING (public.current_app_user_is_admin())';
  END IF;
END $$;

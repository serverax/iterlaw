-- =====================================================================
-- 131_sprint35_wasm_sandbox_phase1.sql
-- =====================================================================
-- Sprint 35 — WASM sandbox module registry (admin-only).
-- Note: migration 115 may already define wasm_module_registry with a legacy
-- composite key; this sprint migration documents the Phase 1 sandbox schema.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.wasm_module_registry (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_hash       TEXT NOT NULL,
  bytecode_size     INT NOT NULL CHECK (bytecode_size >= 0),
  memory_limit_kb   INT NOT NULL CHECK (memory_limit_kb > 0),
  wasm_version      TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wasm_module_registry_hash
  ON public.wasm_module_registry (module_hash);

CREATE INDEX IF NOT EXISTS idx_wasm_module_registry_version
  ON public.wasm_module_registry (wasm_version);

COMMENT ON TABLE public.wasm_module_registry IS
  'Sprint 35 — WASM sandbox module registry (admin RLS).';

ALTER TABLE public.wasm_module_registry ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'wasm_module_registry'
      AND policyname = 'wasm_module_registry_sprint35_admin_all'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY wasm_module_registry_sprint35_admin_all
      ON public.wasm_module_registry
      FOR ALL
      USING (public.current_app_user_is_admin())
      WITH CHECK (public.current_app_user_is_admin())
    $pol$;
  END IF;
END $$;

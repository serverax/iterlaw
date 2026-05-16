-- =====================================================================
-- 134_sprint38_wasm_signed_evidence_packages.sql
-- =====================================================================
-- Sprint 38 — Signed evidence packages (user-scoped).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.wasm_signed_evidence_packages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  package_hash    TEXT NOT NULL,
  signature       TEXT NOT NULL,
  public_key_id   TEXT NOT NULL,
  signed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wasm_signed_pkg_user
  ON public.wasm_signed_evidence_packages (user_id, signed_at DESC);

CREATE INDEX IF NOT EXISTS idx_wasm_signed_pkg_hash
  ON public.wasm_signed_evidence_packages (package_hash);

COMMENT ON TABLE public.wasm_signed_evidence_packages IS
  'Sprint 38 — EdDSA/ECDSA-style signed WASM evidence packages (user RLS).';

ALTER TABLE public.wasm_signed_evidence_packages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wasm_signed_evidence_packages' AND policyname = 'wasm_signed_evidence_packages_self_select') THEN
    EXECUTE 'CREATE POLICY wasm_signed_evidence_packages_self_select ON public.wasm_signed_evidence_packages FOR SELECT USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wasm_signed_evidence_packages' AND policyname = 'wasm_signed_evidence_packages_self_insert') THEN
    EXECUTE 'CREATE POLICY wasm_signed_evidence_packages_self_insert ON public.wasm_signed_evidence_packages FOR INSERT WITH CHECK (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wasm_signed_evidence_packages' AND policyname = 'wasm_signed_evidence_packages_admin_delete') THEN
    EXECUTE 'CREATE POLICY wasm_signed_evidence_packages_admin_delete ON public.wasm_signed_evidence_packages FOR DELETE USING (public.current_app_user_is_admin())';
  END IF;
END $$;

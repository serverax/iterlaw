-- =====================================================================
-- 139_sprint43_wasm_aggregated_proof_pack.sql
-- =====================================================================
-- Sprint 43 — Aggregated proof packs (user-scoped).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.wasm_aggregated_proof_pack (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  original_proofs_count INT NOT NULL CHECK (original_proofs_count > 0),
  aggregated_root       TEXT NOT NULL,
  size_reduction_percent INT NOT NULL CHECK (size_reduction_percent >= 0 AND size_reduction_percent <= 100),
  aggregated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wasm_agg_user
  ON public.wasm_aggregated_proof_pack (user_id, aggregated_at DESC);

CREATE INDEX IF NOT EXISTS idx_wasm_agg_at
  ON public.wasm_aggregated_proof_pack (aggregated_at DESC);

COMMENT ON TABLE public.wasm_aggregated_proof_pack IS
  'Sprint 43 — WASM aggregated proof packs (user RLS).';

ALTER TABLE public.wasm_aggregated_proof_pack ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wasm_aggregated_proof_pack' AND policyname = 'wasm_aggregated_proof_pack_self_select') THEN
    EXECUTE 'CREATE POLICY wasm_aggregated_proof_pack_self_select ON public.wasm_aggregated_proof_pack FOR SELECT USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wasm_aggregated_proof_pack' AND policyname = 'wasm_aggregated_proof_pack_self_insert') THEN
    EXECUTE 'CREATE POLICY wasm_aggregated_proof_pack_self_insert ON public.wasm_aggregated_proof_pack FOR INSERT WITH CHECK (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
END $$;

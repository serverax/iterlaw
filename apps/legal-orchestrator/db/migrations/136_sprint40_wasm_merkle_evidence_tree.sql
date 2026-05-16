-- =====================================================================
-- 136_sprint40_wasm_merkle_evidence_tree.sql
-- =====================================================================
-- Sprint 40 — Merkle evidence commitment trees (user-scoped).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.wasm_merkle_evidence_tree (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  evidence_hash   TEXT NOT NULL,
  merkle_root     TEXT NOT NULL,
  tree_depth      INT NOT NULL CHECK (tree_depth >= 0 AND tree_depth <= 16),
  leaf_count      INT NOT NULL CHECK (leaf_count > 0),
  committed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wasm_merkle_user
  ON public.wasm_merkle_evidence_tree (user_id, committed_at DESC);

CREATE INDEX IF NOT EXISTS idx_wasm_merkle_root
  ON public.wasm_merkle_evidence_tree (merkle_root);

CREATE INDEX IF NOT EXISTS idx_wasm_merkle_committed_at
  ON public.wasm_merkle_evidence_tree (committed_at DESC);

COMMENT ON TABLE public.wasm_merkle_evidence_tree IS
  'Sprint 40 — WASM Merkle evidence commitment (user RLS).';

ALTER TABLE public.wasm_merkle_evidence_tree ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wasm_merkle_evidence_tree' AND policyname = 'wasm_merkle_evidence_tree_self_select') THEN
    EXECUTE 'CREATE POLICY wasm_merkle_evidence_tree_self_select ON public.wasm_merkle_evidence_tree FOR SELECT USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wasm_merkle_evidence_tree' AND policyname = 'wasm_merkle_evidence_tree_self_insert') THEN
    EXECUTE 'CREATE POLICY wasm_merkle_evidence_tree_self_insert ON public.wasm_merkle_evidence_tree FOR INSERT WITH CHECK (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wasm_merkle_evidence_tree' AND policyname = 'wasm_merkle_evidence_tree_admin_delete') THEN
    EXECUTE 'CREATE POLICY wasm_merkle_evidence_tree_admin_delete ON public.wasm_merkle_evidence_tree FOR DELETE USING (public.current_app_user_is_admin())';
  END IF;
END $$;

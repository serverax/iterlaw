-- =====================================================================
-- 138_sprint42_wasm_ledger_sync_log.sql
-- =====================================================================
-- Sprint 42 — WASM ledger sync audit log (admin-only).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.wasm_ledger_sync_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id       TEXT NOT NULL,
  block_hash      TEXT NOT NULL,
  tx_hash         TEXT NOT NULL,
  proof_reference TEXT NOT NULL,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wasm_ledger_block
  ON public.wasm_ledger_sync_log (block_hash);

CREATE INDEX IF NOT EXISTS idx_wasm_ledger_tx
  ON public.wasm_ledger_sync_log (tx_hash);

CREATE INDEX IF NOT EXISTS idx_wasm_ledger_synced_at
  ON public.wasm_ledger_sync_log (synced_at DESC);

COMMENT ON TABLE public.wasm_ledger_sync_log IS
  'Sprint 42 — WASM ledger proof sync audit (admin RLS).';

ALTER TABLE public.wasm_ledger_sync_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wasm_ledger_sync_log' AND policyname = 'wasm_ledger_sync_log_admin_all') THEN
    EXECUTE $pol$
      CREATE POLICY wasm_ledger_sync_log_admin_all
      ON public.wasm_ledger_sync_log
      FOR ALL
      USING (public.current_app_user_is_admin())
      WITH CHECK (public.current_app_user_is_admin())
    $pol$;
  END IF;
END $$;

-- =====================================================================
-- 140_sprint44_wasm_dispute_challenge_log.sql
-- =====================================================================
-- Sprint 44 — WASM dispute challenge log (case-scoped).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.wasm_dispute_challenge_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id               UUID NOT NULL REFERENCES public.legal_case_records(id) ON DELETE CASCADE,
  challenger_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  challenged_proof_hash TEXT NOT NULL,
  challenge_reason      TEXT NOT NULL,
  resolution_outcome    TEXT,
  resolved_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wasm_dispute_case
  ON public.wasm_dispute_challenge_log (case_id, resolved_at DESC);

CREATE INDEX IF NOT EXISTS idx_wasm_dispute_challenger
  ON public.wasm_dispute_challenge_log (challenger_id);

CREATE INDEX IF NOT EXISTS idx_wasm_dispute_resolved
  ON public.wasm_dispute_challenge_log (resolved_at DESC);

COMMENT ON TABLE public.wasm_dispute_challenge_log IS
  'Sprint 44 — WASM dispute challenges (case member RLS).';

ALTER TABLE public.wasm_dispute_challenge_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wasm_dispute_challenge_log' AND policyname = 'wasm_dispute_challenge_log_case_select') THEN
    EXECUTE $pol$
      CREATE POLICY wasm_dispute_challenge_log_case_select
      ON public.wasm_dispute_challenge_log
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.legal_case_records r
          WHERE r.id = case_id
            AND public.current_user_can_write_case(r.workspace_id, r.assigned_user_id)
        )
        OR public.current_app_user_is_admin()
      )
    $pol$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wasm_dispute_challenge_log' AND policyname = 'wasm_dispute_challenge_log_case_insert') THEN
    EXECUTE $pol$
      CREATE POLICY wasm_dispute_challenge_log_case_insert
      ON public.wasm_dispute_challenge_log
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.legal_case_records r
          WHERE r.id = case_id
            AND public.current_user_can_write_case(r.workspace_id, r.assigned_user_id)
        )
        OR public.current_app_user_is_admin()
      )
    $pol$;
  END IF;
END $$;

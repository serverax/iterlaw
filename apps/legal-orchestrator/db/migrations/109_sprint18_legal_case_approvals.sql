-- =====================================================================
-- 109_sprint18_legal_case_approvals.sql
-- =====================================================================
-- Sprint 18 — Admin legal-review: approval audit rows for user cases.
--
-- Hybrid mapping name: case_approvals. Physical table:
--   public.legal_case_approvals (FK to legal_case_records, not corpus).
--
-- RLS: admin-only (uses helpers from 106_enable_rls.sql).
--
-- Idempotent: IF NOT EXISTS / DO blocks for policies.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.legal_case_approvals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id               UUID NOT NULL REFERENCES public.legal_case_records(id) ON DELETE CASCADE,
  approver_id           UUID NOT NULL REFERENCES public.users(id),
  status                TEXT NOT NULL CHECK (status IN ('APPROVED', 'REJECTED')),
  reason                TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_case_approvals_case_id
  ON public.legal_case_approvals (case_id);

CREATE INDEX IF NOT EXISTS idx_legal_case_approvals_approver_id
  ON public.legal_case_approvals (approver_id);

CREATE INDEX IF NOT EXISTS idx_legal_case_approvals_created_at
  ON public.legal_case_approvals (created_at DESC);

COMMENT ON TABLE public.legal_case_approvals IS
  'Admin approval / rejection audit for user workspace cases (Sprint 18).';

ALTER TABLE public.legal_case_approvals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_case_approvals' AND policyname = 'legal_case_approvals_admin_select') THEN
    EXECUTE 'CREATE POLICY legal_case_approvals_admin_select ON public.legal_case_approvals FOR SELECT USING (public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_case_approvals' AND policyname = 'legal_case_approvals_admin_insert') THEN
    EXECUTE 'CREATE POLICY legal_case_approvals_admin_insert ON public.legal_case_approvals FOR INSERT WITH CHECK (public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_case_approvals' AND policyname = 'legal_case_approvals_admin_update') THEN
    EXECUTE 'CREATE POLICY legal_case_approvals_admin_update ON public.legal_case_approvals FOR UPDATE USING (public.current_app_user_is_admin()) WITH CHECK (public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_case_approvals' AND policyname = 'legal_case_approvals_admin_delete') THEN
    EXECUTE 'CREATE POLICY legal_case_approvals_admin_delete ON public.legal_case_approvals FOR DELETE USING (public.current_app_user_is_admin())';
  END IF;
END $$;

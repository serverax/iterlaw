-- Down migration for 109_sprint18_legal_case_approvals.sql (dev only).

DROP POLICY IF EXISTS legal_case_approvals_admin_delete ON public.legal_case_approvals;
DROP POLICY IF EXISTS legal_case_approvals_admin_update ON public.legal_case_approvals;
DROP POLICY IF EXISTS legal_case_approvals_admin_insert ON public.legal_case_approvals;
DROP POLICY IF EXISTS legal_case_approvals_admin_select ON public.legal_case_approvals;

DROP TABLE IF EXISTS public.legal_case_approvals;

-- Down migration 111 (dev only).

DROP POLICY IF EXISTS gdpr_subject_requests_admin_delete ON public.gdpr_subject_requests;
DROP POLICY IF EXISTS gdpr_subject_requests_admin_update ON public.gdpr_subject_requests;
DROP POLICY IF EXISTS gdpr_subject_requests_self_insert ON public.gdpr_subject_requests;
DROP POLICY IF EXISTS gdpr_subject_requests_self_select ON public.gdpr_subject_requests;

DROP POLICY IF EXISTS data_retention_policies_admin_all ON public.data_retention_policies;

DROP TABLE IF EXISTS public.gdpr_subject_requests;
DROP TABLE IF EXISTS public.data_retention_policies;

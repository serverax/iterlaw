DROP POLICY IF EXISTS workspace_case_access_audit_ws_insert ON public.workspace_case_access_audit;
DROP POLICY IF EXISTS workspace_case_access_audit_ws_select ON public.workspace_case_access_audit;

DROP POLICY IF EXISTS case_record_temporal_scope_ws_write ON public.case_record_temporal_scope;
DROP POLICY IF EXISTS case_record_temporal_scope_ws_select ON public.case_record_temporal_scope;

DROP TABLE IF EXISTS public.workspace_case_access_audit;
DROP TABLE IF EXISTS public.case_record_temporal_scope;

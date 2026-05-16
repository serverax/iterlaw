-- Down migration 112 (dev only).

DROP POLICY IF EXISTS law_module_engine_runs_admin_delete ON public.law_module_engine_runs;
DROP POLICY IF EXISTS law_module_engine_runs_admin_update ON public.law_module_engine_runs;
DROP POLICY IF EXISTS law_module_engine_runs_self_insert ON public.law_module_engine_runs;
DROP POLICY IF EXISTS law_module_engine_runs_self_select ON public.law_module_engine_runs;

DROP TABLE IF EXISTS public.law_module_engine_runs;

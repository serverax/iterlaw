-- Down migration 118 (dev only).

DROP POLICY IF EXISTS law_engine_zone2_analysis_admin_delete ON public.law_engine_zone2_analysis;
DROP POLICY IF EXISTS law_engine_zone2_analysis_self_insert ON public.law_engine_zone2_analysis;
DROP POLICY IF EXISTS law_engine_zone2_analysis_self_select ON public.law_engine_zone2_analysis;

DROP TABLE IF EXISTS public.law_engine_zone2_analysis;

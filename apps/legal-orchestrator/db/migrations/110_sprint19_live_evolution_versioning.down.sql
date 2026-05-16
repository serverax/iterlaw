-- Down migration for 110 (dev only).

DROP POLICY IF EXISTS ab_test_metrics_admin_all ON public.ab_test_metrics;
DROP POLICY IF EXISTS ab_test_flags_admin_all ON public.ab_test_flags;
DROP POLICY IF EXISTS rule_versions_admin_all ON public.rule_versions;
DROP POLICY IF EXISTS prompt_versions_admin_all ON public.prompt_versions;

DROP TABLE IF EXISTS public.ab_test_metrics;
DROP TABLE IF EXISTS public.ab_test_flags;
DROP TABLE IF EXISTS public.rule_versions;
DROP TABLE IF EXISTS public.prompt_versions;

-- =====================================================================
-- 110_sprint19_live_evolution_versioning.sql
-- =====================================================================
-- Sprint 19 — prompt/rule versioning + A/B flag tables (live evolution).
-- Admin-only RLS (same posture as 109 / 106 helpers).
-- Idempotent.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.prompt_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key            TEXT NOT NULL,
  version               INT NOT NULL CHECK (version > 0),
  content_hash          TEXT NOT NULL,
  content               TEXT NOT NULL,
  created_by            TEXT,
  approved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT prompt_versions_key_version UNIQUE (prompt_key, version)
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_key
  ON public.prompt_versions (prompt_key);

CREATE TABLE IF NOT EXISTS public.rule_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key              TEXT NOT NULL,
  version               INT NOT NULL CHECK (version > 0),
  content_hash          TEXT NOT NULL,
  content               TEXT NOT NULL,
  created_by            TEXT,
  approved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rule_versions_key_version UNIQUE (rule_key, version)
);

CREATE INDEX IF NOT EXISTS idx_rule_versions_key
  ON public.rule_versions (rule_key);

CREATE TABLE IF NOT EXISTS public.ab_test_flags (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name             TEXT NOT NULL UNIQUE,
  enabled               BOOLEAN NOT NULL DEFAULT false,
  segment_rules         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ab_test_metrics (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id               TEXT NOT NULL,
  variant_version       INT NOT NULL DEFAULT 0,
  conversion_rate       NUMERIC NOT NULL DEFAULT 0,
  error_rate            NUMERIC NOT NULL DEFAULT 0,
  recorded_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ab_test_metrics_test_id
  ON public.ab_test_metrics (test_id);

ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_metrics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'prompt_versions' AND policyname = 'prompt_versions_admin_all') THEN
    EXECUTE 'CREATE POLICY prompt_versions_admin_all ON public.prompt_versions FOR ALL USING (public.current_app_user_is_admin()) WITH CHECK (public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rule_versions' AND policyname = 'rule_versions_admin_all') THEN
    EXECUTE 'CREATE POLICY rule_versions_admin_all ON public.rule_versions FOR ALL USING (public.current_app_user_is_admin()) WITH CHECK (public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ab_test_flags' AND policyname = 'ab_test_flags_admin_all') THEN
    EXECUTE 'CREATE POLICY ab_test_flags_admin_all ON public.ab_test_flags FOR ALL USING (public.current_app_user_is_admin()) WITH CHECK (public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ab_test_metrics' AND policyname = 'ab_test_metrics_admin_all') THEN
    EXECUTE 'CREATE POLICY ab_test_metrics_admin_all ON public.ab_test_metrics FOR ALL USING (public.current_app_user_is_admin()) WITH CHECK (public.current_app_user_is_admin())';
  END IF;
END $$;

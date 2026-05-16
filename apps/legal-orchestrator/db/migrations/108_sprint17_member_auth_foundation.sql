-- =====================================================================
-- 108_sprint17_member_auth_foundation.sql
-- =====================================================================
-- IterLaw Sprint 17 — member auth + subscription + API key foundation.
--
-- Adds:
--   * users.password_hash (nullable; local password auth when set)
--   * user_subscriptions (one row per user; FREE / PRO / ENTERPRISE)
--   * user_api_keys (hashed API keys; raw key never stored)
--
-- RLS: enabled on new tables; policies mirror public.users posture in
-- 106_enable_rls.sql (self + admin). Application must SET LOCAL
-- app.user_id / app.user_role on every request (see 106 header).
--
-- Idempotent: IF NOT EXISTS / DO blocks for policies. No DROP of
-- unrelated objects.
-- =====================================================================

-- ---------------------------------------------------------------------
-- users.password_hash
-- ---------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

COMMENT ON COLUMN public.users.password_hash IS
  'Optional scrypt hash for local email/password auth (Sprint 17). NULL when SSO-only.';

-- ---------------------------------------------------------------------
-- user_subscriptions
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tier                  TEXT NOT NULL
                          CHECK (tier IN ('FREE', 'PRO', 'ENTERPRISE')),
  rate_limit_requests_per_day INT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_subscriptions_user_unique UNIQUE (user_id),
  CONSTRAINT user_subscriptions_rate_limit_ck CHECK (
    (tier = 'ENTERPRISE' AND rate_limit_requests_per_day IS NULL)
    OR (tier IN ('FREE', 'PRO') AND rate_limit_requests_per_day IS NOT NULL
        AND rate_limit_requests_per_day > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id
  ON public.user_subscriptions (user_id);

COMMENT ON TABLE public.user_subscriptions IS
  'Subscription tier + effective per-day rate limit for member auth (Sprint 17).';

-- ---------------------------------------------------------------------
-- user_api_keys
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_api_keys (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  key_hash              TEXT NOT NULL,
  name                  TEXT NOT NULL,
  revoked_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id
  ON public.user_api_keys (user_id);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_revoked_at
  ON public.user_api_keys (revoked_at);

COMMENT ON TABLE public.user_api_keys IS
  'Hashed API keys for programmatic access; raw key material never stored (Sprint 17).';

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

-- user_subscriptions policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_subscriptions' AND policyname = 'user_subscriptions_self_select') THEN
    EXECUTE 'CREATE POLICY user_subscriptions_self_select ON public.user_subscriptions FOR SELECT USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_subscriptions' AND policyname = 'user_subscriptions_self_insert') THEN
    EXECUTE 'CREATE POLICY user_subscriptions_self_insert ON public.user_subscriptions FOR INSERT WITH CHECK (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_subscriptions' AND policyname = 'user_subscriptions_self_update') THEN
    EXECUTE 'CREATE POLICY user_subscriptions_self_update ON public.user_subscriptions FOR UPDATE USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin()) WITH CHECK (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_subscriptions' AND policyname = 'user_subscriptions_admin_delete') THEN
    EXECUTE 'CREATE POLICY user_subscriptions_admin_delete ON public.user_subscriptions FOR DELETE USING (public.current_app_user_is_admin())';
  END IF;
END $$;

-- user_api_keys policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_api_keys' AND policyname = 'user_api_keys_self_select') THEN
    EXECUTE 'CREATE POLICY user_api_keys_self_select ON public.user_api_keys FOR SELECT USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_api_keys' AND policyname = 'user_api_keys_self_insert') THEN
    EXECUTE 'CREATE POLICY user_api_keys_self_insert ON public.user_api_keys FOR INSERT WITH CHECK (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_api_keys' AND policyname = 'user_api_keys_self_update') THEN
    EXECUTE 'CREATE POLICY user_api_keys_self_update ON public.user_api_keys FOR UPDATE USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin()) WITH CHECK (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_api_keys' AND policyname = 'user_api_keys_self_delete') THEN
    EXECUTE 'CREATE POLICY user_api_keys_self_delete ON public.user_api_keys FOR DELETE USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
END $$;

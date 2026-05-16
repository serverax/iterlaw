-- Down migration for 108_sprint17_member_auth_foundation.sql (dev only).

DROP POLICY IF EXISTS user_api_keys_self_delete ON public.user_api_keys;
DROP POLICY IF EXISTS user_api_keys_self_update ON public.user_api_keys;
DROP POLICY IF EXISTS user_api_keys_self_insert ON public.user_api_keys;
DROP POLICY IF EXISTS user_api_keys_self_select ON public.user_api_keys;

DROP POLICY IF EXISTS user_subscriptions_admin_delete ON public.user_subscriptions;
DROP POLICY IF EXISTS user_subscriptions_self_update ON public.user_subscriptions;
DROP POLICY IF EXISTS user_subscriptions_self_insert ON public.user_subscriptions;
DROP POLICY IF EXISTS user_subscriptions_self_select ON public.user_subscriptions;

DROP TABLE IF EXISTS public.user_api_keys;
DROP TABLE IF EXISTS public.user_subscriptions;

ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash;

-- public.users: profile row keyed to Supabase Auth user id
-- id defaults to auth.uid() for client inserts; migrations/seeds may set id explicitly.

CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE,
  oauth_provider VARCHAR(20) NOT NULL,
  oauth_id TEXT NOT NULL,
  subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free',
  subscription_active_until TIMESTAMPTZ,
  jurisdiction VARCHAR(20) NOT NULL DEFAULT 'england_wales',
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  loyalty_tier VARCHAR(20) NOT NULL DEFAULT 'aware',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (oauth_provider, oauth_id)
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_isolation ON public.users
  FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

COMMENT ON TABLE public.users IS 'App profile; id aligns with auth.users when synced from OAuth.';

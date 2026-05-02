-- solicitor_partners: referral network directory (admin JWT claim role=admin)

CREATE TABLE public.solicitor_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_name TEXT NOT NULL UNIQUE,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  jurisdiction_coverage TEXT[] NOT NULL,
  referral_fee NUMERIC(8, 2),
  -- ENCRYPTED at application level before write
  referral_api_key TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.solicitor_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_only ON public.solicitor_partners
  FOR ALL
  USING (coalesce((auth.jwt() ->> 'role')::text, '') = 'admin')
  WITH CHECK (coalesce((auth.jwt() ->> 'role')::text, '') = 'admin');

CREATE TRIGGER set_updated_at_solicitor_partners
  BEFORE UPDATE ON public.solicitor_partners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

COMMENT ON COLUMN public.solicitor_partners.referral_api_key IS 'ENCRYPTED at application level before storage.';
COMMENT ON TABLE public.solicitor_partners IS 'RLS: only JWT role=admin; configure custom claim in Supabase Auth.';

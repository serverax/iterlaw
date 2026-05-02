-- solicitor_referrals: user escalations to partner firms

CREATE TABLE public.solicitor_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  reason VARCHAR(100) NOT NULL,
  case_summary_pdf_url TEXT,
  referred_to_solicitor_id UUID REFERENCES public.solicitor_partners (id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.solicitor_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_isolation ON public.solicitor_referrals
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_referrals_case_id ON public.solicitor_referrals (case_id);
CREATE INDEX idx_referrals_status ON public.solicitor_referrals (status, created_at DESC);

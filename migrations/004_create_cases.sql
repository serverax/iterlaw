-- cases: one employment dispute per row; notes are app-encrypted before write (Week 3)

CREATE TABLE public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  situation_type VARCHAR(50) NOT NULL,
  employment_start_date DATE,
  service_category VARCHAR(50),
  case_stage VARCHAR(50) NOT NULL DEFAULT 'awaiting_hearing',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_date TIMESTAMPTZ,
  -- ENCRYPTED at application level before write (AES-256-GCM; see Week 3)
  notes JSONB
);

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_isolation ON public.cases
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_cases_user_id ON public.cases (user_id);
CREATE INDEX idx_cases_active ON public.cases (is_active, user_id);

CREATE TRIGGER set_updated_at_cases
  BEFORE UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

COMMENT ON COLUMN public.cases.notes IS 'ENCRYPTED at application level before storage; store ciphertext or sealed JSON only.';

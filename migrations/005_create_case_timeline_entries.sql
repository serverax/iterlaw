-- case_timeline_entries: append-only audit trail per case

CREATE TABLE public.case_timeline_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases (id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.case_timeline_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_isolation ON public.case_timeline_entries
  FOR ALL
  USING (
    case_id IN (
      SELECT c.id FROM public.cases c WHERE c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    case_id IN (
      SELECT c.id FROM public.cases c WHERE c.user_id = auth.uid()
    )
  );

CREATE INDEX idx_timeline_case_id ON public.case_timeline_entries (case_id, event_date DESC);

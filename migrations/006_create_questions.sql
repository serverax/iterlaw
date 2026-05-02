-- questions: answer pipeline + semantic cache (pgvector)

CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_embedding vector(1536) NOT NULL,
  jurisdiction VARCHAR(20) NOT NULL,
  situation_type VARCHAR(50) NOT NULL,
  answer_law_section TEXT,
  answer_meaning TEXT,
  answer_action TEXT,
  source_citation TEXT NOT NULL,
  source_url TEXT,
  source_type VARCHAR(50) NOT NULL,
  confidence_score NUMERIC(3, 2) NOT NULL,
  legal_reviewer_approved BOOLEAN NOT NULL DEFAULT false,
  legislation_version VARCHAR(255),
  expires_at DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_isolation ON public.questions
  FOR ALL
  USING (
    user_id = auth.uid()
    OR case_id IN (SELECT c.id FROM public.cases c WHERE c.user_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      case_id IS NULL
      OR case_id IN (SELECT c.id FROM public.cases c WHERE c.user_id = auth.uid())
    )
  );

-- IVFFLAT cosine index (tune lists after meaningful row count in production)
CREATE INDEX idx_question_embedding_cosine ON public.questions
  USING ivfflat (question_embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_questions_user_id ON public.questions (user_id, is_active);
CREATE INDEX idx_questions_case_id ON public.questions (case_id, is_active);
CREATE INDEX idx_questions_expires ON public.questions (expires_at, is_active);
CREATE INDEX idx_questions_approved ON public.questions (legal_reviewer_approved, confidence_score, is_active);

CREATE TRIGGER set_updated_at_questions
  BEFORE UPDATE ON public.questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

COMMENT ON TABLE public.questions IS 'Q&A cache; question_embedding used for semantic dedupe / cache hits.';

-- Phase 1 — Controlled Legal Answer Engine (mirror of backend/supabase/migrations/012_phase1_controlled_answer_engine.sql)

CREATE TABLE IF NOT EXISTS public.qa_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('gov.uk', 'acas', 'legislation')),
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qa_pool_approved_created_idx
  ON public.qa_pool (approved, created_at DESC)
  WHERE approved = TRUE;

CREATE TABLE IF NOT EXISTS public.trusted_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('gov.uk', 'acas', 'legislation')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trusted_content_created_idx
  ON public.trusted_content (created_at DESC);

CREATE INDEX IF NOT EXISTS trusted_content_tags_gin_idx
  ON public.trusted_content USING GIN (tags);

CREATE TABLE IF NOT EXISTS public.legal_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  generated_answer TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS legal_review_queue_status_created_idx
  ON public.legal_review_queue (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ask_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  source_used TEXT,
  response_type TEXT NOT NULL CHECK (response_type IN ('approved_pool', 'trusted_extract', 'under_review', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ask_request_logs_created_idx
  ON public.ask_request_logs (created_at DESC);

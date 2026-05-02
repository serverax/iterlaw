-- Phase 0 Step 8A — Legal review columns, queue, audit log, indexes.
-- Prerequisite: public.qa_pool_entries must exist (apply lib/supabase/migrations/007-qa-pool.sql
-- or equivalent in Supabase before this file if you use only the numbered migrations folder).

-- Step 8A: Add legal review columns to qa_pool_entries
ALTER TABLE public.qa_pool_entries
ADD COLUMN IF NOT EXISTS legal_reviewer_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reviewed_by_solicitor_id UUID REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS decision VARCHAR(50),
ADD COLUMN IF NOT EXISTS disclaimer_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Step 8A: Create review_queue table
CREATE TABLE IF NOT EXISTS public.review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qa_pool_entry_id UUID NOT NULL REFERENCES public.qa_pool_entries(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending_review',
  confidence_score DECIMAL NOT NULL,
  source_type VARCHAR(20) NOT NULL,
  jurisdiction VARCHAR(20) NOT NULL,
  situation_type VARCHAR(50),
  date_queued TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_to_solicitor_id UUID REFERENCES public.users(id),
  review_started_at TIMESTAMPTZ,
  review_completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('pending_review', 'in_review', 'approved', 'approved_with_disclaimer', 'rejected'))
);

-- Step 8A: Create review_audit_log table
CREATE TABLE IF NOT EXISTS public.review_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qa_pool_entry_id UUID NOT NULL REFERENCES public.qa_pool_entries(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.users(id),
  decision VARCHAR(50) NOT NULL,
  rejection_reason VARCHAR(50),
  rejection_detail TEXT,
  disclaimer_text TEXT,
  review_duration_seconds INTEGER,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (decision IN ('approved', 'approved_with_disclaimer', 'rejected')),
  CHECK (rejection_reason IS NULL OR rejection_reason IN ('inaccurate_law', 'inaccurate_meaning', 'unsafe_action', 'source_missing', 'needs_legal_advice'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS qa_pool_entries_approved_idx
ON public.qa_pool_entries(legal_reviewer_approved, is_active);
CREATE INDEX IF NOT EXISTS qa_pool_entries_reviewer_idx
ON public.qa_pool_entries(reviewed_by_solicitor_id);
CREATE INDEX IF NOT EXISTS qa_pool_entries_expires_idx
ON public.qa_pool_entries(expires_at);
CREATE INDEX IF NOT EXISTS review_queue_status_idx
ON public.review_queue(status, date_queued);
CREATE INDEX IF NOT EXISTS review_queue_solicitor_idx
ON public.review_queue(assigned_to_solicitor_id, status);
CREATE INDEX IF NOT EXISTS review_audit_log_entry_idx
ON public.review_audit_log(qa_pool_entry_id);
CREATE INDEX IF NOT EXISTS review_audit_log_reviewer_idx
ON public.review_audit_log(reviewer_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS review_audit_log_decision_idx
ON public.review_audit_log(decision);

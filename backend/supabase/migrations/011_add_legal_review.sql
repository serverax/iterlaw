ALTER TABLE public.qa_pool_entries
ADD COLUMN IF NOT EXISTS legal_reviewer_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reviewed_by_solicitor_id UUID,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS decision VARCHAR(50),
ADD COLUMN IF NOT EXISTS disclaimer_required BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qa_pool_entry_id UUID NOT NULL REFERENCES public.qa_pool_entries(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending_review',
  confidence_score DECIMAL NOT NULL,
  source_type VARCHAR(20) NOT NULL,
  jurisdiction VARCHAR(20) NOT NULL,
  situation_type VARCHAR(50),
  date_queued TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_to_solicitor_id UUID,
  review_started_at TIMESTAMPTZ,
  review_completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('pending_review', 'in_review', 'approved', 'approved_with_disclaimer', 'rejected'))
);

CREATE TABLE IF NOT EXISTS public.review_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qa_pool_entry_id UUID NOT NULL REFERENCES public.qa_pool_entries(id) ON DELETE CASCADE,
  reviewer_id UUID,
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

/*
Verification (run manually after migration):

SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'qa_pool_entries'
ORDER BY ordinal_position;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('review_queue', 'review_audit_log');

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname IN (
  'qa_pool_entries_approved_idx',
  'qa_pool_entries_reviewer_idx',
  'qa_pool_entries_expires_idx',
  'review_queue_status_idx',
  'review_queue_solicitor_idx',
  'review_audit_log_entry_idx',
  'review_audit_log_reviewer_idx',
  'review_audit_log_decision_idx'
)
ORDER BY indexname;

SELECT tc.table_name, tc.constraint_name, tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
AND tc.table_name IN ('review_queue', 'review_audit_log')
AND tc.constraint_type = 'CHECK';
*/

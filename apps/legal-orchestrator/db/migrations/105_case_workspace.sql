-- =====================================================================
-- 105_case_workspace.sql
-- =====================================================================
-- IterLaw — user CASE workspace tables. Six tables, all workspace-
-- scoped, all RLS-eligible (RLS enabled by 106_enable_rls.sql):
--
--   legal_case_records    — the user's IterLaw case (parent).
--   legal_case_facts      — structured facts on the case (extracted /
--                           user-confirmed / system-derived).
--   legal_case_documents  — uploaded documents (contracts, dismissal
--                           letters, payslips, grievance letters, …).
--   legal_case_drafts     — generated drafts (grievance / appeal /
--                           ACAS / tribunal notes).
--   legal_case_timeline   — events on the user's case journey
--                           (uploads, communications, ACAS contact,
--                           grievance / disciplinary / appeal /
--                           settlement events, tribunal deadlines,
--                           system reminders).
--   legal_case_sources    — JOIN: which corpus sources / documents /
--                           chunks / case-law rows were cited on
--                           this user case.
--
-- IMPORTANT — naming disambiguation:
--   * `legal_cases` (added by 102_*) is CORPUS case-law. Shared,
--     non-tenant data. Not user data.
--   * `legal_case_records` (this migration) is the USER'S case
--     within IterLaw. Tenant-scoped, RLS-protected.
--   * `legal_case_sources` (this migration) records which corpus
--     rows the user's case has been linked to. It is the bridge
--     between the user-data side and the corpus side.
--
-- Idempotency contract
-- --------------------
--   * CREATE TABLE IF NOT EXISTS only.
--   * CREATE INDEX IF NOT EXISTS only.
--   * FK constraints added via DO $$ IF NOT EXISTS THEN ALTER ... $$
--     so re-running is a no-op.
--   * No DROP, no DELETE, no TRUNCATE, no destructive ALTER.
--
-- Owner decisions captured in this migration
-- ------------------------------------------
--   * primary_issue is TEXT + CHECK constraint, not a Postgres ENUM
--     (extensible without a destructive ALTER TYPE).
--   * status is TEXT + CHECK constraint with the 15 user-approved
--     values.
--   * legal_case_sources is a JOIN table, not legal_cases.source_id
--     extended; one user case can cite many corpus rows.
--   * legal_case_timeline carries event-type CHECK with the
--     user-approved event taxonomy.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- public.legal_case_records  (PARENT — the user's case)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.legal_case_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL,
  owner_user_id         UUID,
  assigned_user_id      UUID,
  title                 TEXT NOT NULL,
  primary_issue         TEXT NOT NULL
                          CHECK (primary_issue IN (
                            'unfair_dismissal',
                            'constructive_dismissal',
                            'discrimination',
                            'redundancy',
                            'wages_pay',
                            'holiday_pay',
                            'working_time',
                            'sickness_absence',
                            'grievance',
                            'disciplinary',
                            'whistleblowing',
                            'maternity_parental',
                            'contract_terms',
                            'settlement_agreement',
                            'acas_early_conciliation',
                            'employment_tribunal',
                            'other'
                          )),
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN (
                            'draft',
                            'intake',
                            'needs_more_facts',
                            'evidence_collection',
                            'legal_research',
                            'advice_ready',
                            'document_drafting',
                            'submitted',
                            'waiting_response',
                            'acas',
                            'tribunal_preparation',
                            'tribunal_submitted',
                            'settled',
                            'closed',
                            'archived'
                          )),
  jurisdiction          TEXT NOT NULL DEFAULT 'UK',
  employment_start_date DATE,
  employment_end_date   DATE,
  dismissal_date        DATE,
  acas_started_at       DATE,
  acas_certificate_date DATE,
  tribunal_deadline     DATE,
  effective_from        DATE,
  effective_to          DATE,
  summary               TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at             TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_case_records_workspace_id_fkey') THEN
    ALTER TABLE public.legal_case_records
      ADD CONSTRAINT legal_case_records_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_case_records_owner_user_id_fkey') THEN
    ALTER TABLE public.legal_case_records
      ADD CONSTRAINT legal_case_records_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_case_records_assigned_user_id_fkey') THEN
    ALTER TABLE public.legal_case_records
      ADD CONSTRAINT legal_case_records_assigned_user_id_fkey
      FOREIGN KEY (assigned_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_legal_case_records_workspace_id
  ON public.legal_case_records (workspace_id);
CREATE INDEX IF NOT EXISTS idx_legal_case_records_owner_user_id
  ON public.legal_case_records (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_legal_case_records_assigned_user_id
  ON public.legal_case_records (assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_legal_case_records_status
  ON public.legal_case_records (status);
CREATE INDEX IF NOT EXISTS idx_legal_case_records_primary_issue
  ON public.legal_case_records (primary_issue);
CREATE INDEX IF NOT EXISTS idx_legal_case_records_dismissal_date
  ON public.legal_case_records (dismissal_date);
CREATE INDEX IF NOT EXISTS idx_legal_case_records_tribunal_deadline
  ON public.legal_case_records (tribunal_deadline);
CREATE INDEX IF NOT EXISTS idx_legal_case_records_metadata_gin
  ON public.legal_case_records USING GIN (metadata jsonb_path_ops);

COMMENT ON TABLE public.legal_case_records IS
  'IterLaw USER case (not the corpus legal_cases). Workspace-scoped, RLS-protected by 106_enable_rls.sql.';

-- ---------------------------------------------------------------------
-- public.legal_case_facts
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.legal_case_facts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL,
  case_id               UUID NOT NULL,
  fact_key              TEXT NOT NULL,
  fact_value            TEXT,
  fact_source           TEXT NOT NULL DEFAULT 'user'
                          CHECK (fact_source IN ('user', 'document_extraction', 'system_inference', 'reviewer')),
  confidence            NUMERIC(5,4) NOT NULL DEFAULT 1.0000
                          CHECK (confidence >= 0 AND confidence <= 1),
  user_confirmed        BOOLEAN NOT NULL DEFAULT false,
  source_document_id    UUID,
  source_span           TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_case_facts_workspace_id_fkey') THEN
    ALTER TABLE public.legal_case_facts
      ADD CONSTRAINT legal_case_facts_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_case_facts_case_id_fkey') THEN
    ALTER TABLE public.legal_case_facts
      ADD CONSTRAINT legal_case_facts_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.legal_case_records(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_case_facts_case_key_uniq') THEN
    ALTER TABLE public.legal_case_facts
      ADD CONSTRAINT legal_case_facts_case_key_uniq
      UNIQUE (case_id, fact_key);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_legal_case_facts_workspace_id ON public.legal_case_facts (workspace_id);
CREATE INDEX IF NOT EXISTS idx_legal_case_facts_case_id ON public.legal_case_facts (case_id);
CREATE INDEX IF NOT EXISTS idx_legal_case_facts_fact_key ON public.legal_case_facts (fact_key);

COMMENT ON TABLE public.legal_case_facts IS
  'Structured facts per IterLaw user case. RLS-protected.';

-- ---------------------------------------------------------------------
-- public.legal_case_documents
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.legal_case_documents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL,
  case_id               UUID NOT NULL,
  document_type         TEXT NOT NULL
                          CHECK (document_type IN (
                            'employment_contract',
                            'dismissal_letter',
                            'grievance_letter',
                            'appeal_letter',
                            'disciplinary_letter',
                            'payslip',
                            'p45',
                            'p60',
                            'employer_policy',
                            'meeting_notes',
                            'medical_evidence',
                            'witness_statement',
                            'tribunal_correspondence',
                            'acas_correspondence',
                            'settlement_offer',
                            'other'
                          )),
  title                 TEXT,
  filename              TEXT,
  mime_type             TEXT,
  size_bytes            BIGINT,
  storage_uri           TEXT,
  content_hash_sha256   TEXT,
  extraction_status     TEXT NOT NULL DEFAULT 'pending'
                          CHECK (extraction_status IN ('pending', 'extracted', 'failed', 'redacted')),
  extracted_at          TIMESTAMPTZ,
  retention_expires_at  TIMESTAMPTZ,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_case_documents_workspace_id_fkey') THEN
    ALTER TABLE public.legal_case_documents
      ADD CONSTRAINT legal_case_documents_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_case_documents_case_id_fkey') THEN
    ALTER TABLE public.legal_case_documents
      ADD CONSTRAINT legal_case_documents_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.legal_case_records(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_legal_case_documents_workspace_id ON public.legal_case_documents (workspace_id);
CREATE INDEX IF NOT EXISTS idx_legal_case_documents_case_id ON public.legal_case_documents (case_id);
CREATE INDEX IF NOT EXISTS idx_legal_case_documents_extraction_status ON public.legal_case_documents (extraction_status);
CREATE INDEX IF NOT EXISTS idx_legal_case_documents_retention_expires_at ON public.legal_case_documents (retention_expires_at);

COMMENT ON TABLE public.legal_case_documents IS
  'User-uploaded documents per IterLaw case. Storage URI is logical; binary lives off-DB. RLS-protected.';

-- ---------------------------------------------------------------------
-- public.legal_case_drafts
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.legal_case_drafts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL,
  case_id               UUID NOT NULL,
  draft_type            TEXT NOT NULL
                          CHECK (draft_type IN (
                            'grievance_letter',
                            'appeal_letter',
                            'settlement_response',
                            'acas_notes',
                            'tribunal_claim_notes',
                            'witness_statement_outline',
                            'evidence_summary',
                            'other'
                          )),
  title                 TEXT,
  body                  TEXT NOT NULL,
  format                TEXT NOT NULL DEFAULT 'plain'
                          CHECK (format IN ('plain', 'markdown', 'docx', 'html')),
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'reviewed', 'approved', 'sent', 'archived')),
  generated_by          TEXT NOT NULL DEFAULT 'user'
                          CHECK (generated_by IN ('user', 'system', 'reviewer')),
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_case_drafts_workspace_id_fkey') THEN
    ALTER TABLE public.legal_case_drafts
      ADD CONSTRAINT legal_case_drafts_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_case_drafts_case_id_fkey') THEN
    ALTER TABLE public.legal_case_drafts
      ADD CONSTRAINT legal_case_drafts_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.legal_case_records(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_legal_case_drafts_workspace_id ON public.legal_case_drafts (workspace_id);
CREATE INDEX IF NOT EXISTS idx_legal_case_drafts_case_id ON public.legal_case_drafts (case_id);
CREATE INDEX IF NOT EXISTS idx_legal_case_drafts_status ON public.legal_case_drafts (status);

COMMENT ON TABLE public.legal_case_drafts IS
  'Generated drafts per IterLaw case. body holds the latest revision; metadata.version_history can carry prior revisions. RLS-protected.';

-- ---------------------------------------------------------------------
-- public.legal_case_timeline
-- ---------------------------------------------------------------------
-- USER-WORKSPACE timeline: events on the user's case journey, not the
-- corpus case-law timeline.
CREATE TABLE IF NOT EXISTS public.legal_case_timeline (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL,
  case_id               UUID NOT NULL,
  event_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_date            DATE,
  event_type            TEXT NOT NULL
                          CHECK (event_type IN (
                            'user_event',
                            'document_uploaded',
                            'document_extracted',
                            'employer_communication',
                            'employee_communication',
                            'acas_event',
                            'grievance_event',
                            'disciplinary_event',
                            'appeal_event',
                            'settlement_event',
                            'tribunal_event',
                            'deadline_reminder',
                            'system_checkpoint',
                            'system_reminder',
                            'other'
                          )),
  title                 TEXT NOT NULL,
  description           TEXT,
  source_document_id    UUID,
  due_date              DATE,
  severity              TEXT NOT NULL DEFAULT 'info'
                          CHECK (severity IN ('info', 'warning', 'urgent', 'critical')),
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_case_timeline_workspace_id_fkey') THEN
    ALTER TABLE public.legal_case_timeline
      ADD CONSTRAINT legal_case_timeline_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_case_timeline_case_id_fkey') THEN
    ALTER TABLE public.legal_case_timeline
      ADD CONSTRAINT legal_case_timeline_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.legal_case_records(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_legal_case_timeline_workspace_id ON public.legal_case_timeline (workspace_id);
CREATE INDEX IF NOT EXISTS idx_legal_case_timeline_case_id ON public.legal_case_timeline (case_id);
CREATE INDEX IF NOT EXISTS idx_legal_case_timeline_event_at ON public.legal_case_timeline (event_at);
CREATE INDEX IF NOT EXISTS idx_legal_case_timeline_event_type ON public.legal_case_timeline (event_type);
CREATE INDEX IF NOT EXISTS idx_legal_case_timeline_due_date ON public.legal_case_timeline (due_date);
CREATE INDEX IF NOT EXISTS idx_legal_case_timeline_case_event_at ON public.legal_case_timeline (case_id, event_at DESC);

COMMENT ON TABLE public.legal_case_timeline IS
  'Events on a USER case (uploads, communications, ACAS, grievance/disciplinary/appeal, settlement, tribunal, deadlines, reminders). Not the corpus case-law timeline. RLS-protected.';

-- ---------------------------------------------------------------------
-- public.legal_case_sources  (JOIN: user case <-> corpus rows)
-- ---------------------------------------------------------------------
-- One row per (user case, corpus reference). Honours the owner's
-- decision that a case may cite many sources / documents / chunks /
-- statutory rates / case-law rows / guidance pages.
--
-- Corpus reference is captured via four nullable FKs + a free-text
-- canonical citation. At least one of the four reference columns
-- should be set in practice (enforced at the application layer);
-- the CHECK is intentionally loose to tolerate "user-supplied URL
-- with no corpus match yet" during ingestion lag.
CREATE TABLE IF NOT EXISTS public.legal_case_sources (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             UUID NOT NULL,
  case_id                  UUID NOT NULL,
  legal_source_id          UUID,
  legal_document_id        UUID,
  legal_chunk_id           UUID,
  legal_case_id            UUID,
  citation_url             TEXT,
  citation_label           TEXT,
  retrieval_reason         TEXT,
  relevance_score          NUMERIC(5,4)
                              CHECK (relevance_score IS NULL OR (relevance_score >= 0 AND relevance_score <= 1)),
  effective_from           DATE,
  effective_to             DATE,
  metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT legal_case_sources_has_reference
    CHECK (
      legal_source_id IS NOT NULL OR
      legal_document_id IS NOT NULL OR
      legal_chunk_id IS NOT NULL OR
      legal_case_id IS NOT NULL OR
      citation_url IS NOT NULL OR
      citation_label IS NOT NULL
    )
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_case_sources_workspace_id_fkey') THEN
    ALTER TABLE public.legal_case_sources
      ADD CONSTRAINT legal_case_sources_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_case_sources_case_id_fkey') THEN
    ALTER TABLE public.legal_case_sources
      ADD CONSTRAINT legal_case_sources_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.legal_case_records(id) ON DELETE CASCADE;
  END IF;
  -- Corpus FKs are SET NULL on delete: if a corpus row is removed, the
  -- user case still keeps the historical citation (citation_url +
  -- citation_label) for audit.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_case_sources_legal_source_id_fkey') THEN
    ALTER TABLE public.legal_case_sources
      ADD CONSTRAINT legal_case_sources_legal_source_id_fkey
      FOREIGN KEY (legal_source_id) REFERENCES public.legal_sources(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_case_sources_legal_document_id_fkey') THEN
    ALTER TABLE public.legal_case_sources
      ADD CONSTRAINT legal_case_sources_legal_document_id_fkey
      FOREIGN KEY (legal_document_id) REFERENCES public.legal_documents(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_case_sources_legal_chunk_id_fkey') THEN
    ALTER TABLE public.legal_case_sources
      ADD CONSTRAINT legal_case_sources_legal_chunk_id_fkey
      FOREIGN KEY (legal_chunk_id) REFERENCES public.legal_chunks(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_case_sources_legal_case_id_fkey') THEN
    ALTER TABLE public.legal_case_sources
      ADD CONSTRAINT legal_case_sources_legal_case_id_fkey
      FOREIGN KEY (legal_case_id) REFERENCES public.legal_cases(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_legal_case_sources_workspace_id ON public.legal_case_sources (workspace_id);
CREATE INDEX IF NOT EXISTS idx_legal_case_sources_case_id ON public.legal_case_sources (case_id);
CREATE INDEX IF NOT EXISTS idx_legal_case_sources_legal_source_id ON public.legal_case_sources (legal_source_id);
CREATE INDEX IF NOT EXISTS idx_legal_case_sources_legal_document_id ON public.legal_case_sources (legal_document_id);
CREATE INDEX IF NOT EXISTS idx_legal_case_sources_legal_chunk_id ON public.legal_case_sources (legal_chunk_id);
CREATE INDEX IF NOT EXISTS idx_legal_case_sources_legal_case_id ON public.legal_case_sources (legal_case_id);
CREATE INDEX IF NOT EXISTS idx_legal_case_sources_metadata_gin ON public.legal_case_sources USING GIN (metadata jsonb_path_ops);

COMMENT ON TABLE public.legal_case_sources IS
  'JOIN: user IterLaw case <-> corpus sources/documents/chunks/cases. One row per citation. Corpus FKs ON DELETE SET NULL so historical citation_url + citation_label survive corpus changes. RLS-protected.';

-- =====================================================================
-- 102_add_legal_cases_table.sql
-- =====================================================================
-- Adds the canonical `public.legal_cases` table to the approved forward
-- migration path.
--
-- Why this migration exists
-- -------------------------
-- The 001-series migrations (`001_legal_rag_foundation.sql`,
-- `004_legal_rag_sprint10_source_registry.sql`,
-- `007_legal_documents_superseded_by.sql`, etc.) define the canonical
-- RAG primitives `legal_sources`, `legal_documents`, and `legal_chunks`.
-- The 101 migration adds `verified_answers_cache`, `rag_runs`,
-- `source_update_log`, and `answer_verification_log`.
--
-- `legal_cases` (UK case-law ingestion target) only appeared in the
-- draft `100_iterlaw_core_rag_foundation.sql` and in comments. The
-- draft 100 file carries a DO-NOT-APPLY banner per
-- docs/iterlaw/RAG_SCHEMA_CANONICAL_DECISION.md and is **not** part of
-- the approved forward chain. This migration formally adds the table.
--
-- Idempotency contract (mirrors 101)
-- ----------------------------------
--   * Every CREATE uses IF NOT EXISTS.
--   * No DROP, no DELETE, no TRUNCATE.
--   * No RENAME, no destructive ALTER (no column type change, no NOT
--     NULL added to a populated column without DEFAULT, no FK
--     redirect).
--   * Re-running this migration on a database that already has the
--     table — including one populated from 100_* during early bring-up
--     — is a no-op.
--
-- pgcrypto is required for `gen_random_uuid()`. Earlier migrations
-- already create it; we re-assert it here so this file is safe to run
-- standalone in a recovery scenario.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- public.legal_cases
-- ---------------------------------------------------------------------
-- One row per ingested UK case-law decision.
--
-- `source_id` is an optional pointer into `public.legal_sources` so the
-- provenance row (publisher, fetch metadata, retention policy) can be
-- joined. It is intentionally nullable — case ingestion may run before
-- the registry has the provider row.
--
-- `document_id` (added defensively in the same shape as the 100_* draft)
-- is also nullable. If `legal_documents` exists, future migrations can
-- back-fill the FK; we do not declare it as a foreign key here to keep
-- this migration fully additive and resilient against partial schemas.
CREATE TABLE IF NOT EXISTS public.legal_cases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id           UUID,
  document_id         UUID,
  neutral_citation    TEXT,
  case_name           TEXT NOT NULL,
  court               TEXT,
  jurisdiction        TEXT NOT NULL DEFAULT 'UK',
  decision_date       DATE,
  url                 TEXT,
  source_provider     TEXT,
  summary             TEXT,
  full_text           TEXT,
  legal_issues        TEXT[],
  cited_statutes      TEXT[],
  cited_cases         TEXT[],
  outcome_summary     TEXT,
  precedent_level     INT,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Compatibility ALTER block (added 2026-05-13) — must precede every
-- CREATE INDEX below.
-- ---------------------------------------------------------------------
-- These columns are declared by the CREATE TABLE statement above on a
-- fresh database. On a DB that already created public.legal_cases via
-- 100_iterlaw_core_rag_foundation.sql (e.g. a Docker staging replay
-- that applied every .sql file in numeric order), the CREATE TABLE
-- above is a silent no-op — the table exists with the 100-draft shape
-- (which uses `judgment_date` instead of `decision_date`, lacks
-- `source_id`, `source_provider`, `metadata`, `case_name`, `summary`,
-- `full_text`, `url`, `jurisdiction`, `updated_at`). Without this
-- shim, 102's CREATE INDEX statements that reference those columns
-- would fail (e.g. ERROR: column "decision_date" does not exist).
--
-- Every statement here is additive and idempotent:
--   - ADD COLUMN IF NOT EXISTS (no-op if the column already exists).
--   - No NOT NULL on existing tables (existing rows must not fail
--     to satisfy a constraint after the column is added).
--   - DEFAULTs are allowed only where they are safe on Postgres
--     11+ (ADD COLUMN ... DEFAULT does not rewrite existing rows).
--   - No DROP, no DELETE, no TRUNCATE, no destructive ALTER.
-- ---------------------------------------------------------------------

ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS source_id        UUID;
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS case_name        TEXT;
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS jurisdiction     TEXT;
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS decision_date    DATE;
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS url              TEXT;
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS source_provider  TEXT;
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS summary          TEXT;
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS full_text        TEXT;
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS metadata         JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.legal_cases ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT now();

-- ---------------------------------------------------------------------
-- Indexes.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_legal_cases_neutral_citation
  ON public.legal_cases (neutral_citation);

CREATE INDEX IF NOT EXISTS idx_legal_cases_court
  ON public.legal_cases (court);

CREATE INDEX IF NOT EXISTS idx_legal_cases_decision_date
  ON public.legal_cases (decision_date);

CREATE INDEX IF NOT EXISTS idx_legal_cases_source_provider
  ON public.legal_cases (source_provider);

CREATE INDEX IF NOT EXISTS idx_legal_cases_source_id
  ON public.legal_cases (source_id);

CREATE INDEX IF NOT EXISTS idx_legal_cases_document_id
  ON public.legal_cases (document_id);

CREATE INDEX IF NOT EXISTS idx_legal_cases_metadata_gin
  ON public.legal_cases USING GIN (metadata jsonb_path_ops);

-- ---------------------------------------------------------------------
-- Notes (COMMENT ON).
-- ---------------------------------------------------------------------
COMMENT ON TABLE public.legal_cases IS
  'Canonical UK case-law table. Added in migration 102 to the approved 001/101 chain. Additive only; never dropped by a migration.';

COMMENT ON COLUMN public.legal_cases.neutral_citation IS
  'e.g. [2024] UKSC 12. Nullable because some sources publish before assignment.';

COMMENT ON COLUMN public.legal_cases.source_provider IS
  'Free-text label of the upstream (e.g. "Find Case Law", "BAILII"). Used for retention policy decisions and rate-limit attribution.';

COMMENT ON COLUMN public.legal_cases.metadata IS
  'Provider-specific extras (e.g. transcript hash, BAILII fetch timestamp). Never used as a source of truth for fields above.';

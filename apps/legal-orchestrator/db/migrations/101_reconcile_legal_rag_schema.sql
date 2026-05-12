-- =====================================================================
-- 101_reconcile_legal_rag_schema.sql
-- =====================================================================
-- Additive reconciliation between the canonical 001-chain schema and
-- the four genuinely-new top-level tables introduced by the Master
-- Order draft (`100_iterlaw_core_rag_foundation.sql`).
--
-- See docs/iterlaw/RAG_SCHEMA_CANONICAL_DECISION.md for the full
-- decision record. Short version: the 001 chain is canonical for
-- legal_sources / legal_documents / legal_chunks / legal_cases.
-- This migration ONLY adds the four tables that the planner +
-- orchestrator + verifier work needs and that did not exist in 001.
--
-- This migration is safe to apply on top of `010_*`. It does NOT
-- touch any existing 001-chain table. It does NOT DROP, RENAME, or
-- ALTER any existing column. Every statement is idempotent.
--
-- Do NOT apply 100_iterlaw_core_rag_foundation.sql on any database
-- that has already run 001_*. This 101_ migration is the supported
-- reconciliation.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------
-- verified_answers_cache — full prior answers keyed by question hash
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verified_answers_cache (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_hash       TEXT UNIQUE NOT NULL,
  normalized_question TEXT NOT NULL,
  legal_area          TEXT NOT NULL,
  issue_type          TEXT[],
  answer              JSONB NOT NULL,
  citations           JSONB NOT NULL,
  confidence_score    NUMERIC NOT NULL DEFAULT 0,
  verified            BOOLEAN NOT NULL DEFAULT false,
  expires_at          TIMESTAMPTZ,
  source_hashes       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_verified_answers_cache_question_hash
  ON verified_answers_cache(question_hash);
CREATE INDEX IF NOT EXISTS idx_verified_answers_cache_legal_area
  ON verified_answers_cache(legal_area);
CREATE INDEX IF NOT EXISTS idx_verified_answers_cache_expires_at
  ON verified_answers_cache(expires_at);

-- ----------------------------------------------------------------
-- rag_runs — one row per orchestrator request that reached retrieval
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rag_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_question       TEXT NOT NULL,
  normalized_question TEXT,
  jurisdiction        TEXT NOT NULL DEFAULT 'england_wales',
  legal_area          TEXT,
  issue_type          TEXT[],
  retrieval_mode      TEXT,
  sources_used        JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_score    NUMERIC,
  answer_status       TEXT NOT NULL DEFAULT 'insufficient_sources',
  risk_flags          TEXT[],
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rag_runs_created_at      ON rag_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_rag_runs_legal_area      ON rag_runs(legal_area);
CREATE INDEX IF NOT EXISTS idx_rag_runs_answer_status   ON rag_runs(answer_status);

-- ----------------------------------------------------------------
-- source_update_log — audit trail per fetch / supersession
-- (No FK references to legal_sources / legal_documents — the 001
--  chain's source_id/document_id types are uuid, but a freshly-
--  installed cluster without those tables would have NULL FKs at
--  apply time. Leaving the columns as plain uuid so this migration
--  is order-independent within the additive pack.)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS source_update_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id     UUID,
  document_id   UUID,
  source_url    TEXT NOT NULL,
  previous_hash TEXT,
  new_hash      TEXT,
  update_type   TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_source_update_log_source_id
  ON source_update_log(source_id);
CREATE INDEX IF NOT EXISTS idx_source_update_log_document_id
  ON source_update_log(document_id);
CREATE INDEX IF NOT EXISTS idx_source_update_log_created_at
  ON source_update_log(created_at);

-- ----------------------------------------------------------------
-- answer_verification_log — verifier outcome per rag_run / cached answer
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS answer_verification_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_run_id          UUID REFERENCES rag_runs(id),
  answer_cache_id     UUID REFERENCES verified_answers_cache(id),
  verification_status TEXT NOT NULL,
  failed_checks       TEXT[],
  verifier_notes      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_answer_verification_log_rag_run
  ON answer_verification_log(rag_run_id);
CREATE INDEX IF NOT EXISTS idx_answer_verification_log_answer_cache
  ON answer_verification_log(answer_cache_id);
CREATE INDEX IF NOT EXISTS idx_answer_verification_log_status
  ON answer_verification_log(verification_status);

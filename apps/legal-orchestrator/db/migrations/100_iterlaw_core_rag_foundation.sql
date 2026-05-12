-- =====================================================================
-- 100_iterlaw_core_rag_foundation.sql
-- =====================================================================
-- Master-Order canonical RAG foundation.
--
-- Location note: the Master Order specified
--   apps/legal-orchestrator/src/db/migrations/001_legal_rag_foundation.sql
-- The repo's existing convention is `apps/legal-orchestrator/db/migrations/`,
-- which already contains a `001_legal_rag_foundation.sql` from the earlier
-- sprint stack. To avoid clashing with that file and to preserve the
-- existing migration numbering, this migration is named `100_*` (clearly
-- in the new IterLaw-core series).
--
-- Schema this migration defines (per the Master Order):
--   legal_sources, legal_documents, legal_chunks, legal_cases,
--   verified_answers_cache, rag_runs, source_update_log,
--   answer_verification_log
--
-- These names overlap with the older `001_legal_rag_foundation.sql`
-- file (which created its own `legal_sources` etc. with a different
-- column shape). Postgres `CREATE TABLE IF NOT EXISTS` skips already-
-- existing tables — so on a fresh database this migration produces
-- the Master-Order schema. On the older schema, the IF NOT EXISTS
-- guards mean the existing tables are not modified. Operators MUST
-- pick one schema per database; the two schemas are not mergeable
-- by `CREATE TABLE IF NOT EXISTS` alone. See
-- docs/iterlaw/core-engine-master-build.md for the chosen direction.
--
-- Idempotent: every statement is CREATE EXTENSION/TABLE/INDEX
-- IF NOT EXISTS or a CREATE INDEX. No INSERTs. No DROPs.
-- No secrets, no scraping, no HTTP.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS legal_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  authority_tier INT NOT NULL,
  jurisdiction TEXT NOT NULL DEFAULT 'england_wales',
  is_official BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES legal_sources(id),
  title TEXT NOT NULL,
  document_type TEXT NOT NULL,
  official_reference TEXT,
  source_url TEXT NOT NULL,
  version_hash TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  effective_from DATE,
  effective_to DATE,
  jurisdiction TEXT NOT NULL DEFAULT 'england_wales',
  legal_area TEXT NOT NULL DEFAULT 'employment',
  status TEXT NOT NULL DEFAULT 'active',
  raw_text TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legal_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  heading TEXT,
  section_reference TEXT,
  text TEXT NOT NULL,
  token_count INT,
  embedding VECTOR(1536),
  authority_score NUMERIC NOT NULL DEFAULT 0,
  recency_score NUMERIC NOT NULL DEFAULT 0,
  citation_weight NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legal_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES legal_documents(id),
  neutral_citation TEXT,
  court TEXT,
  judgment_date DATE,
  parties TEXT,
  judges TEXT,
  legal_issues TEXT[],
  outcome_summary TEXT,
  precedent_level INT,
  cited_statutes TEXT[],
  cited_cases TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verified_answers_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_hash TEXT UNIQUE NOT NULL,
  normalized_question TEXT NOT NULL,
  legal_area TEXT NOT NULL,
  issue_type TEXT[],
  answer JSONB NOT NULL,
  citations JSONB NOT NULL,
  confidence_score NUMERIC NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  source_hashes JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rag_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_question TEXT NOT NULL,
  normalized_question TEXT,
  jurisdiction TEXT NOT NULL DEFAULT 'england_wales',
  legal_area TEXT,
  issue_type TEXT[],
  retrieval_mode TEXT,
  sources_used JSONB NOT NULL DEFAULT '[]',
  confidence_score NUMERIC,
  answer_status TEXT NOT NULL DEFAULT 'insufficient_sources',
  risk_flags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS source_update_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES legal_sources(id),
  document_id UUID REFERENCES legal_documents(id),
  source_url TEXT NOT NULL,
  previous_hash TEXT,
  new_hash TEXT,
  update_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS answer_verification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_run_id UUID REFERENCES rag_runs(id),
  answer_cache_id UUID REFERENCES verified_answers_cache(id),
  verification_status TEXT NOT NULL,
  failed_checks TEXT[],
  verifier_notes JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_documents_source_id ON legal_documents(source_id);
CREATE INDEX IF NOT EXISTS idx_legal_documents_legal_area ON legal_documents(legal_area);
CREATE INDEX IF NOT EXISTS idx_legal_documents_jurisdiction ON legal_documents(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_legal_documents_effective_dates ON legal_documents(effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_legal_documents_status ON legal_documents(status);
CREATE INDEX IF NOT EXISTS idx_legal_chunks_document_id ON legal_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_legal_chunks_section_reference ON legal_chunks(section_reference);
CREATE INDEX IF NOT EXISTS idx_legal_cases_neutral_citation ON legal_cases(neutral_citation);
CREATE INDEX IF NOT EXISTS idx_legal_cases_court ON legal_cases(court);
CREATE INDEX IF NOT EXISTS idx_legal_cases_judgment_date ON legal_cases(judgment_date);
CREATE INDEX IF NOT EXISTS idx_verified_answers_cache_question_hash ON verified_answers_cache(question_hash);
CREATE INDEX IF NOT EXISTS idx_rag_runs_created_at ON rag_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_rag_runs_legal_area ON rag_runs(legal_area);
CREATE INDEX IF NOT EXISTS idx_rag_runs_answer_status ON rag_runs(answer_status);

CREATE INDEX IF NOT EXISTS idx_legal_chunks_embedding
ON legal_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

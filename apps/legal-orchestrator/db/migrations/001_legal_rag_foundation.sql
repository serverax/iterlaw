-- =====================================================================
-- 001_legal_rag_foundation.sql
-- =====================================================================
-- OrdinoxAI / RightsNow legal RAG foundation.
--
-- Scope: structural-only. No real scraped data is inserted. The schema is
-- reusable across domains (UK employment first, with room for housing,
-- immigration, benefits, debt, Swedish employment law, etc).
--
-- Idempotent: every CREATE uses IF NOT EXISTS; INSERTs use ON CONFLICT.
-- Safe to run repeatedly. Does NOT drop or alter existing rows.
--
-- Requires: PostgreSQL 13+ (for gen_random_uuid() in pg_catalog).
-- Optional: pgvector — embedding column + vector index are added only if
--           the `vector` extension is installed. See PGVECTOR section near
--           the end. The migration still succeeds without pgvector.
-- =====================================================================


-- ---------------------------------------------------------------------
-- legal_domains
-- ---------------------------------------------------------------------
-- One row per legal practice area + jurisdiction pairing the platform
-- supports. Every other table foreign-keys into this so multi-domain
-- isolation is enforced at the schema level.
CREATE TABLE IF NOT EXISTS legal_domains (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_code     text NOT NULL UNIQUE,            -- 'uk_employment_law', 'se_employment_law', 'uk_housing_law', ...
  jurisdiction    text NOT NULL,                   -- 'England and Wales', 'Scotland', 'Sverige', ...
  display_name    text NOT NULL,                   -- 'UK Employment Law (England & Wales)'
  description     text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legal_domains_active_idx
  ON legal_domains(is_active) WHERE is_active = true;


-- ---------------------------------------------------------------------
-- legal_sources
-- ---------------------------------------------------------------------
-- One row per upstream source we ingest (a statute, a guidance page,
-- a case, an ACAS document, etc). A source can produce many documents
-- (e.g. multiple in-force versions of the same statute).
CREATE TABLE IF NOT EXISTS legal_sources (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id         uuid NOT NULL REFERENCES legal_domains(id) ON DELETE RESTRICT,
  source_type       text NOT NULL,                 -- enum check below
  publisher         text,                          -- 'The National Archives', 'ACAS', 'GOV.UK', ...
  title             text NOT NULL,
  citation_label    text,                          -- 'ERA 1996 s.95', 'ACAS Code of Practice (Disciplinary and Grievance)'
  jurisdiction      text NOT NULL,                 -- denormalised from domain for fast filter
  source_url        text,                          -- where we fetched it
  canonical_url     text,                          -- stable identifier (e.g. legislation.gov.uk URI)
  effective_date    date,                          -- when the source took effect
  authority_level   int NOT NULL DEFAULT 50,       -- 100=statute, 90=SI, 85=appeal, 70=tribunal, 60=ACAS, 50=GOV.UK, 30=internal
  content_hash      text,                          -- SHA256 of canonical content (dedup)
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legal_sources_source_type_chk CHECK (source_type IN (
    'legislation',
    'statutory_instrument',
    'gov_guidance',
    'acas_guidance',
    'tribunal_case',
    'appeal_case',
    'case_law',
    'internal_note',
    'template'
  )),
  -- Prevent re-ingesting the same upstream URL into the same domain.
  CONSTRAINT legal_sources_dedup_uq UNIQUE (domain_id, source_type, canonical_url)
);

CREATE INDEX IF NOT EXISTS legal_sources_domain_idx
  ON legal_sources(domain_id);
CREATE INDEX IF NOT EXISTS legal_sources_jurisdiction_idx
  ON legal_sources(jurisdiction);
CREATE INDEX IF NOT EXISTS legal_sources_source_type_idx
  ON legal_sources(source_type);
CREATE INDEX IF NOT EXISTS legal_sources_effective_date_idx
  ON legal_sources(effective_date);
CREATE INDEX IF NOT EXISTS legal_sources_content_hash_idx
  ON legal_sources(content_hash);
CREATE INDEX IF NOT EXISTS legal_sources_active_idx
  ON legal_sources(is_active) WHERE is_active = true;


-- ---------------------------------------------------------------------
-- legal_documents
-- ---------------------------------------------------------------------
-- A specific version of a source. For statutes there is typically one
-- document per in-force version date; for cases there is normally one
-- document per case. Holds the raw + cleaned text.
CREATE TABLE IF NOT EXISTS legal_documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id           uuid NOT NULL REFERENCES legal_sources(id) ON DELETE CASCADE,
  domain_id           uuid NOT NULL REFERENCES legal_domains(id) ON DELETE RESTRICT,
  title               text NOT NULL,
  canonical_url       text,
  official_reference  text,                        -- 'Employment Rights Act 1996 s.95'
  version_date        date,                        -- in-force-on date for this version
  effective_date      date,                        -- when the document content became effective
  content_hash        text,                        -- SHA256(clean_text)
  raw_text            text,
  clean_text          text,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legal_documents_version_uq UNIQUE (source_id, official_reference, version_date)
);

CREATE INDEX IF NOT EXISTS legal_documents_source_idx
  ON legal_documents(source_id);
CREATE INDEX IF NOT EXISTS legal_documents_domain_idx
  ON legal_documents(domain_id);
CREATE INDEX IF NOT EXISTS legal_documents_content_hash_idx
  ON legal_documents(content_hash);
CREATE INDEX IF NOT EXISTS legal_documents_effective_date_idx
  ON legal_documents(effective_date);
CREATE INDEX IF NOT EXISTS legal_documents_active_idx
  ON legal_documents(is_active) WHERE is_active = true;


-- ---------------------------------------------------------------------
-- legal_chunks
-- ---------------------------------------------------------------------
-- Searchable RAG units. One row per chunk produced from a document.
-- Carries enough denormalised metadata to be a self-contained citation.
CREATE TABLE IF NOT EXISTS legal_chunks (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id          uuid NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  domain_id            uuid NOT NULL REFERENCES legal_domains(id) ON DELETE RESTRICT,
  jurisdiction         text NOT NULL,
  source_type          text NOT NULL,
  title                text NOT NULL,
  url                  text,
  citation_label       text,
  section_reference    text,
  paragraph_reference  text,
  chunk_index          int NOT NULL,
  chunk_text           text NOT NULL,
  token_count          int,
  content_hash         text,
  authority_level      int NOT NULL DEFAULT 50,
  version_date         date,
  effective_date       date,
  quality_score        numeric(3,2),               -- 0.00..1.00; null if not yet scored
  embedding_status     text NOT NULL DEFAULT 'pending'
    CHECK (embedding_status IN ('pending','ready','failed','disabled')),
  -- Search column is generated from textual fields. Postgres FTS is the
  -- primary retrieval path; embedding column (added by the pgvector
  -- guard below) is optional.
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(title,'') || ' ' ||
      coalesce(citation_label,'') || ' ' ||
      coalesce(section_reference,'') || ' ' ||
      coalesce(chunk_text,'')
    )
  ) STORED,
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legal_chunks_doc_idx_uq UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS legal_chunks_document_idx
  ON legal_chunks(document_id);
CREATE INDEX IF NOT EXISTS legal_chunks_domain_jur_type_idx
  ON legal_chunks(domain_id, jurisdiction, source_type);
CREATE INDEX IF NOT EXISTS legal_chunks_content_hash_idx
  ON legal_chunks(content_hash);
CREATE INDEX IF NOT EXISTS legal_chunks_effective_date_idx
  ON legal_chunks(effective_date);
CREATE INDEX IF NOT EXISTS legal_chunks_active_idx
  ON legal_chunks(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS legal_chunks_search_vector_idx
  ON legal_chunks USING GIN(search_vector);


-- ---------------------------------------------------------------------
-- legal_citations
-- ---------------------------------------------------------------------
-- Stable citation rows. When an answer is generated the citation_label
-- shown to the user comes from here; this lets us version citation
-- formatting separately from the underlying chunks.
CREATE TABLE IF NOT EXISTS legal_citations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id          uuid NOT NULL REFERENCES legal_chunks(id) ON DELETE CASCADE,
  citation_label    text NOT NULL,
  context_snippet   text,                          -- short text around the cited claim
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legal_citations_chunk_idx
  ON legal_citations(chunk_id);


-- ---------------------------------------------------------------------
-- legal_case_law
-- ---------------------------------------------------------------------
-- Metadata for cases. Both Employment Tribunal and Employment Appeal
-- Tribunal records share this base; ET-specifics live in
-- tribunal_decisions.
CREATE TABLE IF NOT EXISTS legal_case_law (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id           uuid NOT NULL REFERENCES legal_sources(id) ON DELETE CASCADE,
  case_name           text NOT NULL,
  neutral_citation    text,                        -- '[2024] EWCA Civ 123'
  claim_number        text,                        -- ET claim number where applicable
  court_or_tribunal   text,                        -- 'Employment Tribunal (Leeds)', 'EAT', ...
  judges              text,
  parties             text,
  topics              text[],
  outcome             text,
  decision_date       date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legal_case_law_source_idx
  ON legal_case_law(source_id);
CREATE INDEX IF NOT EXISTS legal_case_law_decision_date_idx
  ON legal_case_law(decision_date);


-- ---------------------------------------------------------------------
-- tribunal_decisions
-- ---------------------------------------------------------------------
-- ET-specific fields layered on top of legal_case_law.
CREATE TABLE IF NOT EXISTS tribunal_decisions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_law_id         uuid NOT NULL REFERENCES legal_case_law(id) ON DELETE CASCADE,
  region              text,                        -- 'England and Wales', 'Scotland'
  hearing_dates       daterange,
  panel_members       text,
  represented_by      text,
  award_amount        numeric,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tribunal_decisions_case_law_idx
  ON tribunal_decisions(case_law_id);
CREATE INDEX IF NOT EXISTS tribunal_decisions_region_idx
  ON tribunal_decisions(region);


-- ---------------------------------------------------------------------
-- legislation_versions
-- ---------------------------------------------------------------------
-- Tracks in-force-on versions of a statute. Critical for "what did the
-- law say on date X". One document maps to many versions.
CREATE TABLE IF NOT EXISTS legislation_versions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id         uuid NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  version_label       text NOT NULL,               -- 'in-force-2024-04-06'
  version_date        date NOT NULL,
  amends_version_id   uuid REFERENCES legislation_versions(id) ON DELETE SET NULL,
  text_excerpt        text,                        -- short excerpt summarising what changed
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legislation_versions_doc_date_uq UNIQUE (document_id, version_date)
);

CREATE INDEX IF NOT EXISTS legislation_versions_document_idx
  ON legislation_versions(document_id);


-- ---------------------------------------------------------------------
-- rag_ingestion_jobs
-- ---------------------------------------------------------------------
-- One row per ingestion run. Append-only audit; do not delete completed
-- rows. Tracks scrapers + bulk imports.
CREATE TABLE IF NOT EXISTS rag_ingestion_jobs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id           uuid REFERENCES legal_domains(id) ON DELETE SET NULL,
  source_name         text NOT NULL,
  source_type         text NOT NULL,
  start_url           text,
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed')),
  started_at          timestamptz,
  finished_at         timestamptz,
  documents_found     int NOT NULL DEFAULT 0,
  documents_inserted  int NOT NULL DEFAULT 0,
  documents_updated   int NOT NULL DEFAULT 0,
  chunks_inserted     int NOT NULL DEFAULT 0,
  error_message       text,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rag_ingestion_jobs_status_idx
  ON rag_ingestion_jobs(status);
CREATE INDEX IF NOT EXISTS rag_ingestion_jobs_created_at_idx
  ON rag_ingestion_jobs(created_at DESC);


-- ---------------------------------------------------------------------
-- rag_ingestion_events
-- ---------------------------------------------------------------------
-- Granular event log emitted by ingestion jobs. Useful for debugging
-- and quality control.
CREATE TABLE IF NOT EXISTS rag_ingestion_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              uuid NOT NULL REFERENCES rag_ingestion_jobs(id) ON DELETE CASCADE,
  event_type          text NOT NULL CHECK (event_type IN (
    'fetch_attempted','fetch_succeeded','fetch_failed',
    'parse_failed','chunk_inserted','chunk_skipped_duplicate',
    'embed_pending','embed_completed','embed_failed'
  )),
  source_url          text,
  detail              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rag_ingestion_events_job_idx
  ON rag_ingestion_events(job_id);
CREATE INDEX IF NOT EXISTS rag_ingestion_events_type_idx
  ON rag_ingestion_events(event_type);
CREATE INDEX IF NOT EXISTS rag_ingestion_events_created_at_idx
  ON rag_ingestion_events(created_at DESC);


-- ---------------------------------------------------------------------
-- rag_query_audit
-- ---------------------------------------------------------------------
-- One row per RAG search. Lets us replay queries and review retrieval
-- quality without touching the answer.
CREATE TABLE IF NOT EXISTS rag_query_audit (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id          text NOT NULL,
  user_id             uuid,                        -- nullable (anonymous/system)
  workspace_id        uuid,
  domain_id           uuid REFERENCES legal_domains(id) ON DELETE SET NULL,
  query_text          text NOT NULL,
  jurisdiction        text,
  topic               text,
  filters             jsonb NOT NULL DEFAULT '{}'::jsonb,
  chunks_returned     int NOT NULL DEFAULT 0,
  top_chunk_ids       uuid[],
  model_used          text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rag_query_audit_request_idx
  ON rag_query_audit(request_id);
CREATE INDEX IF NOT EXISTS rag_query_audit_user_idx
  ON rag_query_audit(user_id);
CREATE INDEX IF NOT EXISTS rag_query_audit_created_at_idx
  ON rag_query_audit(created_at DESC);


-- ---------------------------------------------------------------------
-- answer_audit_log
-- ---------------------------------------------------------------------
-- One row per generated answer, regardless of whether it was returned
-- to the user. Failed-citation and policy-fail answers are kept here as
-- audit (NOT user-visible) for analysis.
CREATE TABLE IF NOT EXISTS answer_audit_log (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id               text NOT NULL,
  rag_query_id             uuid REFERENCES rag_query_audit(id) ON DELETE SET NULL,
  status                   text NOT NULL,           -- matches AnswerStatus enum in app
  model_used               text,
  answer                   text,
  citations                jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_facts            jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_warnings            jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_llm_used        boolean NOT NULL DEFAULT false,
  passed_citation_check    boolean NOT NULL DEFAULT false,
  passed_policy_check      boolean NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS answer_audit_log_request_idx
  ON answer_audit_log(request_id);
CREATE INDEX IF NOT EXISTS answer_audit_log_created_at_idx
  ON answer_audit_log(created_at DESC);


-- ---------------------------------------------------------------------
-- source_quality_scores
-- ---------------------------------------------------------------------
-- Solicitor / auto-reviewer scores per source. Append-only; the latest
-- row wins for downstream reranking.
CREATE TABLE IF NOT EXISTS source_quality_scores (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id           uuid NOT NULL REFERENCES legal_sources(id) ON DELETE CASCADE,
  score               numeric(3,2) NOT NULL CHECK (score BETWEEN 0 AND 1),
  reviewed_by         text NOT NULL,                -- 'solicitor:UUID', 'auto'
  review_notes        text,
  reviewed_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS source_quality_scores_source_idx
  ON source_quality_scores(source_id);


-- =====================================================================
-- updated_at trigger function (shared)
-- =====================================================================
CREATE OR REPLACE FUNCTION rag_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'legal_domains', 'legal_sources', 'legal_documents',
    'legal_chunks', 'legal_case_law'
  ] LOOP
    -- DROP and re-CREATE so the trigger is idempotent.
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_updated_at ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION rag_set_updated_at()',
      t, t
    );
  END LOOP;
END
$$;


-- =====================================================================
-- PGVECTOR section (optional)
-- =====================================================================
-- pgvector is REQUIRED for IterLaw RAG. The prerequisite migration
-- 000_pgvector_prerequisite.sql must have been applied first (it runs
-- `CREATE EXTENSION IF NOT EXISTS vector;`). If that step is skipped
-- this block fails clearly rather than silently degrading the deploy
-- to FTS-only retrieval — see infra/iterlaw/database-contract.md.
DO $$
DECLARE
  has_vector boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') INTO has_vector;
  IF NOT has_vector THEN
    RAISE EXCEPTION USING
      ERRCODE = 'feature_not_supported',
      MESSAGE = 'pgvector extension is not installed in this database.',
      DETAIL  = 'Migration 001 requires the `vector` extension for the legal_chunks.embedding column and the IVFFlat index.',
      HINT    = 'Run migration 000_pgvector_prerequisite.sql first, or ensure the Postgres image is pgvector/pgvector:pg16.';
  END IF;
  EXECUTE 'ALTER TABLE legal_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536)';
  -- IVFFlat: good for >1000 rows. Smaller corpora can drop the index;
  -- queries still work without it (sequential scan).
  EXECUTE 'CREATE INDEX IF NOT EXISTS legal_chunks_embedding_ivfflat_idx ON legal_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)';
  RAISE NOTICE 'pgvector confirmed: embedding column + IVFFlat index in place.';
END
$$;


-- =====================================================================
-- Seed data (safe, structural only — no real scraped law content)
-- =====================================================================
-- One domain: UK employment law (England & Wales). Other domains can be
-- added by separate seed scripts; this migration intentionally seeds
-- only the bare minimum so the FK constraints can be satisfied during
-- early development.
INSERT INTO legal_domains (domain_code, jurisdiction, display_name, description)
VALUES (
  'uk_employment_law',
  'England and Wales',
  'UK Employment Law (England & Wales)',
  'Statutes, statutory instruments, ACAS guidance, GOV.UK guidance, Employment Tribunal and EAT decisions for England & Wales.'
)
ON CONFLICT (domain_code) DO NOTHING;


-- Sentinel placeholder source: makes downstream FK targets exist for
-- application bootstrap. Contains NO real legal content; canonical_url
-- uses a reserved internal scheme so it cannot collide with real URLs.
INSERT INTO legal_sources (
  domain_id, source_type, publisher, title, citation_label,
  jurisdiction, canonical_url, authority_level, is_active
)
SELECT
  d.id, 'internal_note', 'OrdinoxAI', 'Bootstrap placeholder', 'BOOTSTRAP',
  d.jurisdiction, 'urn:ordinoxai:bootstrap:uk_employment', 0, false
FROM legal_domains d
WHERE d.domain_code = 'uk_employment_law'
ON CONFLICT (domain_id, source_type, canonical_url) DO NOTHING;

-- End of 001_legal_rag_foundation.sql

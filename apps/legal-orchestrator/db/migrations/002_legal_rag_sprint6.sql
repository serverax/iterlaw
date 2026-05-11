-- =====================================================================
-- 002_legal_rag_sprint6.sql
-- =====================================================================
-- Sprint 6 — UK employment RAG: additional production tables, embeddings
-- split-out, ingestion + fetch audit, citation registry, query audit fields.
--
-- Prerequisites: 001_legal_rag_foundation.sql applied (legal_domains,
-- legal_sources, legal_documents, legal_chunks, rag_query_audit, …).
--
-- Idempotent: CREATE IF NOT EXISTS, guarded ALTERs, constraint replace
-- wrapped in DO blocks. Re-runnable.
-- No data ingestion. No external calls.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) ingestion_jobs — canonical job table (Sprint 6 naming)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id          uuid REFERENCES legal_domains(id) ON DELETE SET NULL,
  legal_domain       text NOT NULL,                    -- e.g. uk_employment_law (denormalised)
  source_type        text NOT NULL,
  job_kind           text NOT NULL DEFAULT 'fetch'
    CHECK (job_kind IN ('fetch', 'bulk_import', 'reembed', 'validate', 'purge_cache')),
  status             text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  config             jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at         timestamptz,
  finished_at        timestamptz,
  documents_found    int NOT NULL DEFAULT 0,
  documents_inserted int NOT NULL DEFAULT 0,
  documents_updated  int NOT NULL DEFAULT 0,
  chunks_inserted    int NOT NULL DEFAULT 0,
  error_summary      text,
  stats              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ingestion_jobs_legal_domain_idx
  ON ingestion_jobs(legal_domain);
CREATE INDEX IF NOT EXISTS ingestion_jobs_source_type_idx
  ON ingestion_jobs(source_type);
CREATE INDEX IF NOT EXISTS ingestion_jobs_status_idx
  ON ingestion_jobs(status);
CREATE INDEX IF NOT EXISTS ingestion_jobs_created_at_idx
  ON ingestion_jobs(created_at DESC);


-- ---------------------------------------------------------------------
-- 2) ingestion_job_events — per-step audit inside a job
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingestion_job_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid NOT NULL REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
  event_type      text NOT NULL,
  source_url      text,
  http_status     int,
  checksum        text,
  error_detail    text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ingestion_job_events_type_chk CHECK (event_type IN (
    'queued', 'started', 'fetch_attempted', 'fetch_succeeded', 'fetch_failed',
    'parse_started', 'parse_succeeded', 'parse_failed',
    'chunk_written', 'chunk_skipped_duplicate', 'embed_queued', 'embed_completed', 'embed_failed',
    'job_completed', 'job_failed', 'cancelled'
  ))
);

CREATE INDEX IF NOT EXISTS ingestion_job_events_job_idx
  ON ingestion_job_events(job_id);
CREATE INDEX IF NOT EXISTS ingestion_job_events_created_idx
  ON ingestion_job_events(created_at DESC);
CREATE INDEX IF NOT EXISTS ingestion_job_events_http_status_idx
  ON ingestion_job_events(http_status);


-- ---------------------------------------------------------------------
-- 3) source_fetch_audit — HTTP-level fetch audit (per URL attempt)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS source_fetch_audit (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id             uuid REFERENCES ingestion_jobs(id) ON DELETE SET NULL,
  legal_domain       text NOT NULL,
  source_type        text NOT NULL,
  url                text NOT NULL,
  fetch_status       text NOT NULL
    CHECK (fetch_status IN ('success', 'failed', 'skipped', 'redirect_followed')),
  http_status        int,
  response_checksum  text,
  content_length     bigint,
  error_message      text,
  fetched_at         timestamptz NOT NULL DEFAULT now(),
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS source_fetch_audit_job_idx
  ON source_fetch_audit(job_id);
CREATE INDEX IF NOT EXISTS source_fetch_audit_domain_type_idx
  ON source_fetch_audit(legal_domain, source_type);
CREATE INDEX IF NOT EXISTS source_fetch_audit_url_idx
  ON source_fetch_audit(url);
CREATE INDEX IF NOT EXISTS source_fetch_audit_fetched_at_idx
  ON source_fetch_audit(fetched_at DESC);
CREATE INDEX IF NOT EXISTS source_fetch_audit_checksum_idx
  ON source_fetch_audit(response_checksum);


-- ---------------------------------------------------------------------
-- 4) legal_document_versions — version hash + dates per document
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS legal_document_versions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id        uuid NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  version_label      text NOT NULL,
  version_hash       text NOT NULL,
  publication_date   date,
  last_checked_at    timestamptz,
  effective_from     date,
  effective_to       date,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legal_document_versions_doc_hash_uq UNIQUE (document_id, version_hash)
);

CREATE INDEX IF NOT EXISTS legal_document_versions_document_idx
  ON legal_document_versions(document_id);
CREATE INDEX IF NOT EXISTS legal_document_versions_hash_idx
  ON legal_document_versions(version_hash);
CREATE INDEX IF NOT EXISTS legal_document_versions_pub_date_idx
  ON legal_document_versions(publication_date);


-- ---------------------------------------------------------------------
-- 5) legal_chunk_embeddings — optional pgvector; bytea fallback always
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS legal_chunk_embeddings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id             uuid NOT NULL REFERENCES legal_chunks(id) ON DELETE CASCADE,
  embedding_model      text NOT NULL,
  embedding_dimensions int NOT NULL,
  embedding_bytea      bytea,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legal_chunk_embeddings_model_uq UNIQUE (chunk_id, embedding_model)
);

CREATE INDEX IF NOT EXISTS legal_chunk_embeddings_chunk_idx
  ON legal_chunk_embeddings(chunk_id);


-- ---------------------------------------------------------------------
-- 6) citation_registry — exact URL, title, section/para, accessed_at
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS citation_registry (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id             uuid NOT NULL REFERENCES legal_chunks(id) ON DELETE CASCADE,
  source_url           text NOT NULL,
  title                text NOT NULL,
  section_reference    text,
  paragraph_reference  text,
  accessed_at          timestamptz NOT NULL DEFAULT now(),
  registry_hash        text NOT NULL,
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT citation_registry_chunk_hash_uq UNIQUE (chunk_id, registry_hash)
);

CREATE INDEX IF NOT EXISTS citation_registry_chunk_idx
  ON citation_registry(chunk_id);
CREATE INDEX IF NOT EXISTS citation_registry_url_idx
  ON citation_registry(source_url);
CREATE INDEX IF NOT EXISTS citation_registry_accessed_at_idx
  ON citation_registry(accessed_at DESC);
CREATE INDEX IF NOT EXISTS citation_registry_active_idx
  ON citation_registry(is_active) WHERE is_active = true;


-- ---------------------------------------------------------------------
-- 7) rag_query_audit — ranking + final citation IDs (ALTER if missing)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rag_query_audit' AND column_name = 'retrieved_chunk_ids'
  ) THEN
    ALTER TABLE rag_query_audit ADD COLUMN retrieved_chunk_ids uuid[];
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rag_query_audit' AND column_name = 'ranking_scores'
  ) THEN
    ALTER TABLE rag_query_audit ADD COLUMN ranking_scores jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rag_query_audit' AND column_name = 'final_citation_ids'
  ) THEN
    ALTER TABLE rag_query_audit ADD COLUMN final_citation_ids uuid[];
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rag_query_audit' AND column_name = 'query_redacted'
  ) THEN
    ALTER TABLE rag_query_audit ADD COLUMN query_redacted text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS rag_query_audit_ranking_gin_idx
  ON rag_query_audit USING GIN (ranking_scores);


-- ---------------------------------------------------------------------
-- 8) legal_sources — extend source_type + publication / last_checked
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'legal_sources_source_type_chk'
  ) THEN
    ALTER TABLE legal_sources DROP CONSTRAINT legal_sources_source_type_chk;
  END IF;
END $$;

ALTER TABLE legal_sources ADD CONSTRAINT legal_sources_source_type_chk CHECK (source_type IN (
  'legislation',
  'legislation_gov_uk',
  'statutory_instrument',
  'gov_guidance',
  'acas_guidance',
  'tribunal_case',
  'employment_tribunal_decision',
  'appeal_case',
  'case_law',
  'hmcts',
  'ehrc',
  'cac',
  'internal_note',
  'template'
));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'legal_sources' AND column_name = 'publication_date'
  ) THEN
    ALTER TABLE legal_sources ADD COLUMN publication_date date;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'legal_sources' AND column_name = 'last_checked_at'
  ) THEN
    ALTER TABLE legal_sources ADD COLUMN last_checked_at timestamptz;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'legal_sources' AND column_name = 'legal_domain'
  ) THEN
    ALTER TABLE legal_sources ADD COLUMN legal_domain text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS legal_sources_legal_domain_idx
  ON legal_sources(legal_domain);


-- ---------------------------------------------------------------------
-- 9) legal_documents — legal_domain denorm + version hash at doc level
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'legal_documents' AND column_name = 'legal_domain'
  ) THEN
    ALTER TABLE legal_documents ADD COLUMN legal_domain text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'legal_documents' AND column_name = 'version_hash'
  ) THEN
    ALTER TABLE legal_documents ADD COLUMN version_hash text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'legal_documents' AND column_name = 'publication_date'
  ) THEN
    ALTER TABLE legal_documents ADD COLUMN publication_date date;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'legal_documents' AND column_name = 'last_checked_at'
  ) THEN
    ALTER TABLE legal_documents ADD COLUMN last_checked_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS legal_documents_legal_domain_idx
  ON legal_documents(legal_domain);
CREATE INDEX IF NOT EXISTS legal_documents_version_hash_idx
  ON legal_documents(version_hash);


-- ---------------------------------------------------------------------
-- 10) legal_chunks — section heading + publication / last_checked
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'legal_chunks' AND column_name = 'section_heading'
  ) THEN
    ALTER TABLE legal_chunks ADD COLUMN section_heading text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'legal_chunks' AND column_name = 'legal_domain'
  ) THEN
    ALTER TABLE legal_chunks ADD COLUMN legal_domain text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'legal_chunks' AND column_name = 'publication_date'
  ) THEN
    ALTER TABLE legal_chunks ADD COLUMN publication_date date;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'legal_chunks' AND column_name = 'last_checked_at'
  ) THEN
    ALTER TABLE legal_chunks ADD COLUMN last_checked_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS legal_chunks_legal_domain_idx
  ON legal_chunks(legal_domain);


-- ---------------------------------------------------------------------
-- 11) pgvector column on legal_chunk_embeddings (optional)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  has_vector boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') INTO has_vector;
  IF has_vector THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'legal_chunk_embeddings' AND column_name = 'embedding'
    ) THEN
      EXECUTE 'ALTER TABLE legal_chunk_embeddings ADD COLUMN embedding vector(1536)';
    END IF;
    RAISE NOTICE 'pgvector: added embedding column on legal_chunk_embeddings. Create IVFFlat/HNSW after bulk load (empty tables often fail IVFFlat build).';
  ELSE
    RAISE NOTICE 'pgvector not installed: use embedding_bytea or FTS-only; add vector extension later.';
  END IF;
END $$;


-- End of 002_legal_rag_sprint6.sql

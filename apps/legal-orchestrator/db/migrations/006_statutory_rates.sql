-- =====================================================================
-- 006_statutory_rates.sql
-- =====================================================================
-- Adds schema-only tables for UK employment-law statutory rates and Vento
-- bands. Each row MUST cite a row in uk_emp_rag.legal_sources and carry a
-- canonical_url + effective_from. Values are NOT seeded here: they must be
-- populated by the Sprint 11 ingestion pipeline against primary sources
-- (gov.uk minimum-wage page, Employment Rights Act 1996, Vento Presidential
-- Guidance) so that every figure is traceable to a verified document_chunk.
--
-- Prerequisites: 003 (uk_emp_rag schema + legal_sources table),
--                004 (Sprint 10 trusted-source rows).
-- Idempotent: CREATE TABLE IF NOT EXISTS. No INSERTs.
-- No scraping, no HTTP, no secrets, no DATABASE_URL.
-- =====================================================================

CREATE TABLE IF NOT EXISTS uk_emp_rag.statutory_rate (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category        text        NOT NULL,
  value           numeric(14, 4) NOT NULL,
  unit            text        NOT NULL,
  effective_from  date        NOT NULL,
  effective_to    date        NULL,
  source_id       uuid        NOT NULL REFERENCES uk_emp_rag.legal_sources(id) ON DELETE RESTRICT,
  canonical_url   text        NOT NULL,
  notes           text        NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_emp_rag_statutory_rate_unit_chk CHECK (unit IN (
    'GBP',
    'GBP_PER_HOUR',
    'GBP_PER_WEEK',
    'WEEKS',
    'PERCENT'
  )),
  CONSTRAINT uk_emp_rag_statutory_rate_window_chk CHECK (
    effective_to IS NULL OR effective_to > effective_from
  ),
  CONSTRAINT uk_emp_rag_statutory_rate_url_https_chk CHECK (
    canonical_url LIKE 'https://%'
  )
);

CREATE INDEX IF NOT EXISTS uk_emp_rag_statutory_rate_category_effective_idx
  ON uk_emp_rag.statutory_rate (category, effective_from DESC);

CREATE INDEX IF NOT EXISTS uk_emp_rag_statutory_rate_source_idx
  ON uk_emp_rag.statutory_rate (source_id);

-- Prevents two open-ended rows for the same category (overlapping windows
-- would make "which rate applies on date X" ambiguous).
CREATE UNIQUE INDEX IF NOT EXISTS uk_emp_rag_statutory_rate_one_open_per_category_uq
  ON uk_emp_rag.statutory_rate (category)
  WHERE effective_to IS NULL;


CREATE TABLE IF NOT EXISTS uk_emp_rag.vento_band (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  band_level      text        NOT NULL,
  min_value       numeric(12, 2) NOT NULL,
  max_value       numeric(12, 2) NOT NULL,
  unit            text        NOT NULL DEFAULT 'GBP',
  effective_from  date        NOT NULL,
  effective_to    date        NULL,
  source_id       uuid        NOT NULL REFERENCES uk_emp_rag.legal_sources(id) ON DELETE RESTRICT,
  canonical_url   text        NOT NULL,
  notes           text        NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uk_emp_rag_vento_band_level_chk CHECK (band_level IN (
    'lower',
    'middle',
    'upper'
  )),
  CONSTRAINT uk_emp_rag_vento_band_order_chk CHECK (max_value > min_value),
  CONSTRAINT uk_emp_rag_vento_band_window_chk CHECK (
    effective_to IS NULL OR effective_to > effective_from
  ),
  CONSTRAINT uk_emp_rag_vento_band_url_https_chk CHECK (
    canonical_url LIKE 'https://%'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_emp_rag_vento_band_one_open_per_level_uq
  ON uk_emp_rag.vento_band (band_level)
  WHERE effective_to IS NULL;

CREATE INDEX IF NOT EXISTS uk_emp_rag_vento_band_source_idx
  ON uk_emp_rag.vento_band (source_id);


-- ---------------------------------------------------------------------
-- TEMPLATE (NOT EXECUTED). Reference shape for the ingestion pipeline.
-- Concrete figures must come from the cited primary source on the cited
-- effective_from date, verified by a normalised document hash in
-- uk_emp_rag.legal_documents. Do NOT uncomment without a verified ingest.
-- ---------------------------------------------------------------------
-- INSERT INTO uk_emp_rag.statutory_rate
--   (category, value, unit, effective_from, source_id, canonical_url, notes)
-- VALUES
--   ('national_minimum_wage_21_plus',
--    <verified_value>, 'GBP_PER_HOUR', '<verified_effective_from>',
--    (SELECT id FROM uk_emp_rag.legal_sources WHERE name = 'GOV.UK Employment'),
--    'https://www.gov.uk/national-minimum-wage-rates',
--    'Populate from ingested gov.uk page after Sprint 11 normalisation.');
--
-- INSERT INTO uk_emp_rag.vento_band
--   (band_level, min_value, max_value, effective_from, source_id, canonical_url, notes)
-- VALUES
--   ('lower',  <verified_min>, <verified_max>, '<verified_effective_from>',
--    (SELECT id FROM uk_emp_rag.legal_sources WHERE name = 'GOV.UK Employment'),
--    '<verified_canonical_url_to_presidential_guidance>',
--    'Populate from ingested Vento presidential guidance after Sprint 11 normalisation.');

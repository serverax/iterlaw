-- =====================================================================
-- 010_legal_documents_statutory_seed.sql
-- =====================================================================
-- Seeds uk_emp_rag.legal_documents with the four cited statutory-document
-- shells that a future statutory_rate seed (migration 011) will reference
-- by canonical_url. No scraping, no chunks, no embeddings; rows carry
-- metadata.seed_row=true and metadata.ingestion_pending=true so real
-- ingestion runs can supersede them without confusion.
--
-- Cited sources (canonical URLs):
--   1) GOV.UK National Minimum Wage rates (effective 1 April 2026)
--   2) The Statutory Sick Pay (General) (Amendment) Regulations 2026
--      legislation.gov.uk SI 2026/310
--   3) GOV.UK Redundancy pay statutory cap (effective 6 April 2026)
--   4) Judiciary UK Vento bands Presidential Guidance
--      (injury-to-feelings discrimination compensation)
--
-- Prerequisites:
--   003 (uk_emp_rag.legal_documents + uk_emp_rag.legal_sources)
--   004 (legal_sources canonical UUIDs)
--   007 (status CHECK tightened to 'active' | 'superseded' | 'withdrawn')
--
-- Idempotent: deterministic UUIDs + ON CONFLICT (id) DO UPDATE.
-- No HTTP client calls, no DATABASE_URL, no secrets, no external network.
-- =====================================================================

INSERT INTO uk_emp_rag.legal_documents (
  id,
  source_id,
  title,
  canonical_url,
  document_type,
  topic,
  jurisdiction,
  content_hash,
  metadata,
  status
) VALUES
  (
    '01900010-0010-4000-8000-000000000001'::uuid,
    '01900010-0000-4000-8000-000000000002'::uuid,  -- GOV.UK Employment
    'National Minimum Wage and National Living Wage rates (from 1 April 2026)',
    'https://www.gov.uk/national-minimum-wage-rates',
    'rates_guidance',
    'minimum_wage',
    'UK',
    'seed:nmw-2026-04-01:v1',
    jsonb_build_object(
      'seed_row',           true,
      'ingestion_pending',  true,
      'citation_label',     'GOV.UK — NMW and NLW rates 2026',
      'effective_from',     '2026-04-01'
    ),
    'active'
  ),
  (
    '01900010-0010-4000-8000-000000000002'::uuid,
    '01900010-0000-4000-8000-000000000001'::uuid,  -- legislation.gov.uk
    'Statutory Sick Pay (General) (Amendment) Regulations 2026 — SI 2026/310',
    'https://www.legislation.gov.uk/uksi/2026/310',
    'regulations',
    'statutory_sick_pay',
    'UK',
    'seed:uksi-2026-310:v1',
    jsonb_build_object(
      'seed_row',           true,
      'ingestion_pending',  true,
      'citation_label',     'SI 2026/310',
      'si_number',          '2026/310'
    ),
    'active'
  ),
  (
    '01900010-0010-4000-8000-000000000003'::uuid,
    '01900010-0000-4000-8000-000000000002'::uuid,  -- GOV.UK Employment
    'Redundancy pay: statutory cap on a week''s pay (from 6 April 2026)',
    'https://www.gov.uk/redundancy-your-rights/redundancy-pay',
    'rates_guidance',
    'redundancy',
    'UK',
    'seed:redundancy-cap-2026:v1',
    jsonb_build_object(
      'seed_row',           true,
      'ingestion_pending',  true,
      'citation_label',     'GOV.UK — Redundancy pay statutory cap 2026',
      'effective_from',     '2026-04-06'
    ),
    'active'
  ),
  (
    '01900010-0010-4000-8000-000000000004'::uuid,
    '01900010-0000-4000-8000-000000000007'::uuid,  -- Judiciary UK
    'Presidential Guidance — Vento bands (injury to feelings)',
    'https://www.judiciary.uk/guidance-and-resources/vento-bands-presidential-guidance/',
    'tribunal_guidance',
    'discrimination_compensation',
    'UK',
    'seed:vento-presidential-guidance:v1',
    jsonb_build_object(
      'seed_row',           true,
      'ingestion_pending',  true,
      'citation_label',     'Vento Presidential Guidance'
    ),
    'active'
  )
ON CONFLICT (id) DO UPDATE SET
  source_id     = EXCLUDED.source_id,
  title         = EXCLUDED.title,
  canonical_url = EXCLUDED.canonical_url,
  document_type = EXCLUDED.document_type,
  topic         = EXCLUDED.topic,
  jurisdiction  = EXCLUDED.jurisdiction,
  content_hash  = EXCLUDED.content_hash,
  metadata      = EXCLUDED.metadata,
  status        = EXCLUDED.status,
  updated_at    = now();

-- End of 010_legal_documents_statutory_seed.sql

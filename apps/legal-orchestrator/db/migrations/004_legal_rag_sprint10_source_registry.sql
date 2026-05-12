-- =====================================================================
-- 004_legal_rag_sprint10_source_registry.sql
-- =====================================================================
-- Sprint 10 — UK Employment Law trusted source registry seed.
-- Inserts canonical rows into uk_emp_rag.legal_sources only.
--
-- Prerequisites: 003_legal_rag_sprint9_uk_employment_core.sql (schema + table).
-- Idempotent: deterministic UUID primary keys + ON CONFLICT (id) DO UPDATE.
-- No scraping, no HTTP clients, no secrets, no DATABASE_URL.
-- =====================================================================

-- Widen CHECK constraints from Sprint 9 so Sprint 10 source_type / trust_level values apply.
ALTER TABLE uk_emp_rag.legal_sources
  DROP CONSTRAINT IF EXISTS uk_emp_rag_legal_sources_source_type_chk;
ALTER TABLE uk_emp_rag.legal_sources
  ADD CONSTRAINT uk_emp_rag_legal_sources_source_type_chk CHECK (source_type IN (
    'legislation',
    'gov_guidance',
    'acas_guidance',
    'tribunal_decision',
    'eat_decision',
    'hmcts_guidance',
    'trusted_secondary_source',
    'court_judgment',
    'archive',
    'legal_database',
    'equality_guidance',
    'data_protection_guidance',
    'health_safety_guidance',
    'pensions_guidance'
  ));

ALTER TABLE uk_emp_rag.legal_sources
  DROP CONSTRAINT IF EXISTS uk_emp_rag_legal_sources_trust_level_chk;
ALTER TABLE uk_emp_rag.legal_sources
  ADD CONSTRAINT uk_emp_rag_legal_sources_trust_level_chk CHECK (trust_level IN (
    'primary_law',
    'official_guidance',
    'tribunal_authority',
    'secondary_guidance',
    'official_archive',
    'court_authority',
    'legal_database'
  ));

-- Deterministic UUIDs (Sprint 10 seed namespace). Down migration deletes by these ids only.
INSERT INTO uk_emp_rag.legal_sources (
  id, name, source_type, base_url, jurisdiction, trust_level, enabled
) VALUES
  (
    '01900010-0000-4000-8000-000000000001'::uuid,
    'legislation.gov.uk',
    'legislation',
    'https://www.legislation.gov.uk',
    'UK',
    'primary_law',
    true
  ),
  (
    '01900010-0000-4000-8000-000000000002'::uuid,
    'GOV.UK Employment',
    'gov_guidance',
    'https://www.gov.uk/browse/employing-people',
    'UK',
    'official_guidance',
    true
  ),
  (
    '01900010-0000-4000-8000-000000000003'::uuid,
    'ACAS',
    'acas_guidance',
    'https://www.acas.org.uk',
    'UK',
    'official_guidance',
    true
  ),
  (
    '01900010-0000-4000-8000-000000000004'::uuid,
    'Employment Tribunal Decisions',
    'tribunal_decision',
    'https://www.gov.uk/employment-tribunal-decisions',
    'UK',
    'tribunal_authority',
    true
  ),
  (
    '01900010-0000-4000-8000-000000000005'::uuid,
    'Employment Appeal Tribunal Decisions',
    'eat_decision',
    'https://www.gov.uk/employment-appeal-tribunal-decisions',
    'UK',
    'tribunal_authority',
    true
  ),
  (
    '01900010-0000-4000-8000-000000000006'::uuid,
    'HMCTS Forms and Guidance',
    'hmcts_guidance',
    'https://www.gov.uk/government/organisations/hm-courts-and-tribunals-service',
    'UK',
    'official_guidance',
    true
  ),
  (
    '01900010-0000-4000-8000-000000000007'::uuid,
    'Judiciary UK',
    'court_judgment',
    'https://www.judiciary.uk',
    'UK',
    'tribunal_authority',
    true
  ),
  (
    '01900010-0000-4000-8000-000000000008'::uuid,
    'The National Archives',
    'archive',
    'https://www.nationalarchives.gov.uk',
    'UK',
    'official_archive',
    true
  ),
  (
    '01900010-0000-4000-8000-000000000009'::uuid,
    'Supreme Court UK',
    'court_judgment',
    'https://www.supremecourt.uk',
    'UK',
    'court_authority',
    true
  ),
  (
    '01900010-0000-4000-8000-00000000000a'::uuid,
    'BAILII',
    'legal_database',
    'https://www.bailii.org',
    'UK',
    'legal_database',
    true
  ),
  (
    '01900010-0000-4000-8000-00000000000b'::uuid,
    'Equality and Human Rights Commission',
    'equality_guidance',
    'https://www.equalityhumanrights.com',
    'UK',
    'official_guidance',
    true
  ),
  (
    '01900010-0000-4000-8000-00000000000c'::uuid,
    'ICO Employment Practices',
    'data_protection_guidance',
    'https://ico.org.uk',
    'UK',
    'official_guidance',
    true
  ),
  (
    '01900010-0000-4000-8000-00000000000d'::uuid,
    'Health and Safety Executive',
    'health_safety_guidance',
    'https://www.hse.gov.uk',
    'UK',
    'official_guidance',
    true
  ),
  (
    '01900010-0000-4000-8000-00000000000e'::uuid,
    'Department for Business and Trade',
    'gov_guidance',
    'https://www.gov.uk/government/organisations/department-for-business-and-trade',
    'UK',
    'official_guidance',
    true
  ),
  (
    '01900010-0000-4000-8000-00000000000f'::uuid,
    'The Pensions Regulator',
    'pensions_guidance',
    'https://www.thepensionsregulator.gov.uk',
    'UK',
    'official_guidance',
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name            = EXCLUDED.name,
  source_type     = EXCLUDED.source_type,
  base_url        = EXCLUDED.base_url,
  jurisdiction    = EXCLUDED.jurisdiction,
  trust_level     = EXCLUDED.trust_level,
  enabled         = EXCLUDED.enabled,
  updated_at      = now();

-- End of 004_legal_rag_sprint10_source_registry.sql

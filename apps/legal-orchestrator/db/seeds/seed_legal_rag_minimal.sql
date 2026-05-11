-- =====================================================================
-- seed_legal_rag_minimal.sql
-- =====================================================================
-- Idempotent seed for the legal RAG tables defined in
-- migrations/001_legal_rag_foundation.sql.
--
-- Contains FIVE chunks of SHORT PARAPHRASED text only — not actual
-- statutory wording. These rows exist so retrieval, ranking, and the
-- module pipeline can be exercised end-to-end against a real DB without
-- copying copyrighted material.
--
-- Apply (operator-only — NOT executed by this repo):
--   psql "$DATABASE_URL" \
--     -f apps/legal-orchestrator/db/seeds/seed_legal_rag_minimal.sql
--
-- Or inside a K3s pod:
--   kubectl -n ordinox-ai exec -i deploy/postgres-pgvector -- \
--     psql -U ordinox_legal -d ordinox_legal_ai \
--     < apps/legal-orchestrator/db/seeds/seed_legal_rag_minimal.sql
-- =====================================================================

BEGIN;

-- All chunks belong to the canonical UK domain seeded by 001.
WITH domain AS (
  SELECT id FROM legal_domains WHERE domain_code = 'uk_employment_law' LIMIT 1
)
INSERT INTO legal_sources (
  id, domain_id, source_type, publisher, title, citation_label,
  jurisdiction, source_url, canonical_url, effective_date,
  authority_level, content_hash, is_active
)
SELECT * FROM (VALUES
  (
    '11111111-1111-1111-1111-111111111111'::uuid,
    (SELECT id FROM domain),
    'legislation',
    'The National Archives',
    'Employment Rights Act 1996',
    'ERA 1996',
    'England and Wales',
    'https://www.legislation.gov.uk/ukpga/1996/18',
    'urn:ordinoxai:seed:era-1996',
    '1996-05-22'::date,
    100,
    'seed_hash_era1996',
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222'::uuid,
    (SELECT id FROM domain),
    'legislation',
    'The National Archives',
    'Equality Act 2010',
    'EqA 2010',
    'England and Wales',
    'https://www.legislation.gov.uk/ukpga/2010/15',
    'urn:ordinoxai:seed:eqa-2010',
    '2010-10-01'::date,
    100,
    'seed_hash_eqa2010',
    true
  ),
  (
    '33333333-3333-3333-3333-333333333333'::uuid,
    (SELECT id FROM domain),
    'acas_guidance',
    'ACAS',
    'ACAS Code of Practice on Disciplinary and Grievance Procedures',
    'ACAS CoP 2015',
    'England and Wales',
    'https://www.acas.org.uk/acas-code-of-practice-on-disciplinary-and-grievance-procedures',
    'urn:ordinoxai:seed:acas-cop-2015',
    '2015-03-11'::date,
    60,
    'seed_hash_acas_2015',
    true
  ),
  (
    '44444444-4444-4444-4444-444444444444'::uuid,
    (SELECT id FROM domain),
    'gov_guidance',
    'GOV.UK',
    'Dismissal: an overview',
    'GOV.UK Dismissal Overview',
    'England and Wales',
    'https://www.gov.uk/dismissal',
    'urn:ordinoxai:seed:govuk-dismissal',
    '2024-04-06'::date,
    50,
    'seed_hash_govuk_dismissal',
    true
  )
) AS s
ON CONFLICT (domain_id, source_type, canonical_url) DO NOTHING;


WITH domain AS (
  SELECT id FROM legal_domains WHERE domain_code = 'uk_employment_law' LIMIT 1
)
INSERT INTO legal_documents (
  id, source_id, domain_id, title, canonical_url, official_reference,
  version_date, effective_date, content_hash, raw_text, clean_text, is_active
)
SELECT * FROM (VALUES
  (
    'd1111111-1111-1111-1111-111111111111'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    (SELECT id FROM domain),
    'Employment Rights Act 1996 — Section 95',
    'https://www.legislation.gov.uk/ukpga/1996/18/section/95',
    'Employment Rights Act 1996 s.95',
    '2024-04-06'::date,
    '1996-08-22'::date,
    'seed_doc_era_s95',
    NULL,
    'Paraphrased excerpt about circumstances of dismissal — for seed use only.',
    true
  ),
  (
    'd1111111-1111-1111-1111-111111111112'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    (SELECT id FROM domain),
    'Employment Rights Act 1996 — Section 98',
    'https://www.legislation.gov.uk/ukpga/1996/18/section/98',
    'Employment Rights Act 1996 s.98',
    '2024-04-06'::date,
    '1996-08-22'::date,
    'seed_doc_era_s98',
    NULL,
    'Paraphrased excerpt about potentially fair reasons for dismissal — for seed use only.',
    true
  ),
  (
    'd2222222-2222-2222-2222-222222222222'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    (SELECT id FROM domain),
    'Equality Act 2010 — Section 13',
    'https://www.legislation.gov.uk/ukpga/2010/15/section/13',
    'Equality Act 2010 s.13',
    '2024-04-06'::date,
    '2010-10-01'::date,
    'seed_doc_eqa_s13',
    NULL,
    'Paraphrased excerpt about direct discrimination — for seed use only.',
    true
  ),
  (
    'd3333333-3333-3333-3333-333333333333'::uuid,
    '33333333-3333-3333-3333-333333333333'::uuid,
    (SELECT id FROM domain),
    'ACAS Code on Disciplinary and Grievance Procedures',
    'https://www.acas.org.uk/acas-code-of-practice-on-disciplinary-and-grievance-procedures',
    'ACAS CoP s.1',
    '2015-03-11'::date,
    '2015-03-11'::date,
    'seed_doc_acas',
    NULL,
    'Paraphrased excerpt about fair disciplinary procedure — for seed use only.',
    true
  ),
  (
    'd4444444-4444-4444-4444-444444444444'::uuid,
    '44444444-4444-4444-4444-444444444444'::uuid,
    (SELECT id FROM domain),
    'GOV.UK — Dismissal: an overview',
    'https://www.gov.uk/dismissal',
    'GOV.UK Dismissal',
    '2024-04-06'::date,
    '2024-04-06'::date,
    'seed_doc_govuk',
    NULL,
    'Paraphrased excerpt about unfair dismissal and tribunals — for seed use only.',
    true
  )
) AS d
ON CONFLICT (source_id, official_reference, version_date) DO NOTHING;


WITH domain AS (
  SELECT id FROM legal_domains WHERE domain_code = 'uk_employment_law' LIMIT 1
)
INSERT INTO legal_chunks (
  id, document_id, domain_id, jurisdiction, source_type, title, url,
  citation_label, section_reference, chunk_index, chunk_text,
  authority_level, is_active
)
SELECT * FROM (VALUES
  (
    'c1111111-1111-1111-1111-111111111111'::uuid,
    'd1111111-1111-1111-1111-111111111111'::uuid,
    (SELECT id FROM domain),
    'England and Wales',
    'legislation',
    'Employment Rights Act 1996 — Section 95',
    'https://www.legislation.gov.uk/ukpga/1996/18/section/95',
    'ERA 1996 s.95(1)',
    '95(1)',
    0,
    'An employee is dismissed when the contract of employment is terminated by the employer, with or without notice, or when the employee resigns in response to a serious breach of contract by the employer. (paraphrased seed)',
    100,
    true
  ),
  (
    'c1111111-1111-1111-1111-111111111112'::uuid,
    'd1111111-1111-1111-1111-111111111112'::uuid,
    (SELECT id FROM domain),
    'England and Wales',
    'legislation',
    'Employment Rights Act 1996 — Section 98',
    'https://www.legislation.gov.uk/ukpga/1996/18/section/98',
    'ERA 1996 s.98',
    '98',
    0,
    'It is for the employer to show the reason for the dismissal and that the reason is one of the potentially fair reasons including capability, conduct, redundancy, statutory restriction, or some other substantial reason. (paraphrased seed)',
    100,
    true
  ),
  (
    'c2222222-2222-2222-2222-222222222222'::uuid,
    'd2222222-2222-2222-2222-222222222222'::uuid,
    (SELECT id FROM domain),
    'England and Wales',
    'legislation',
    'Equality Act 2010 — Section 13',
    'https://www.legislation.gov.uk/ukpga/2010/15/section/13',
    'EqA 2010 s.13',
    '13',
    0,
    'A person discriminates against another if, because of a protected characteristic, they treat that other less favourably than they treat or would treat another person. (paraphrased seed)',
    100,
    true
  ),
  (
    'c3333333-3333-3333-3333-333333333333'::uuid,
    'd3333333-3333-3333-3333-333333333333'::uuid,
    (SELECT id FROM domain),
    'England and Wales',
    'acas_guidance',
    'ACAS Code on Disciplinary and Grievance Procedures',
    'https://www.acas.org.uk/acas-code-of-practice-on-disciplinary-and-grievance-procedures',
    'ACAS CoP 2015',
    NULL,
    0,
    'Employers should follow a fair disciplinary procedure, including a written invitation to a meeting, an opportunity to be accompanied, a reasonable investigation, and a right of appeal. (paraphrased seed)',
    60,
    true
  ),
  (
    'c4444444-4444-4444-4444-444444444444'::uuid,
    'd4444444-4444-4444-4444-444444444444'::uuid,
    (SELECT id FROM domain),
    'England and Wales',
    'gov_guidance',
    'GOV.UK — Dismissal: an overview',
    'https://www.gov.uk/dismissal',
    'GOV.UK Dismissal',
    NULL,
    0,
    'If you are dismissed you may have a right to claim unfair dismissal at an Employment Tribunal. There are time limits and ACAS Early Conciliation is normally required first. (paraphrased seed)',
    50,
    true
  )
) AS ch
ON CONFLICT (document_id, chunk_index) DO NOTHING;

COMMIT;

-- Verification queries (read-only)
SELECT 'chunks_in_uk_employment:' || count(*)::text
FROM legal_chunks c
JOIN legal_domains d ON d.id = c.domain_id
WHERE d.domain_code = 'uk_employment_law' AND c.is_active = true;

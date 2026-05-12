-- =====================================================================
-- 004_legal_rag_sprint10_source_registry.down.sql
-- =====================================================================
-- Removes only Sprint 10 trusted-registry seed rows (deterministic UUIDs).
-- Does NOT drop schema uk_emp_rag. Does NOT delete user-ingested sources
-- outside this id set.
-- Restores Sprint 9 CHECK constraints on uk_emp_rag.legal_sources.
-- =====================================================================

DELETE FROM uk_emp_rag.legal_sources
WHERE id IN (
  '01900010-0000-4000-8000-000000000001'::uuid,
  '01900010-0000-4000-8000-000000000002'::uuid,
  '01900010-0000-4000-8000-000000000003'::uuid,
  '01900010-0000-4000-8000-000000000004'::uuid,
  '01900010-0000-4000-8000-000000000005'::uuid,
  '01900010-0000-4000-8000-000000000006'::uuid,
  '01900010-0000-4000-8000-000000000007'::uuid,
  '01900010-0000-4000-8000-000000000008'::uuid,
  '01900010-0000-4000-8000-000000000009'::uuid,
  '01900010-0000-4000-8000-00000000000a'::uuid,
  '01900010-0000-4000-8000-00000000000b'::uuid,
  '01900010-0000-4000-8000-00000000000c'::uuid,
  '01900010-0000-4000-8000-00000000000d'::uuid,
  '01900010-0000-4000-8000-00000000000e'::uuid,
  '01900010-0000-4000-8000-00000000000f'::uuid
);

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
    'trusted_secondary_source'
  ));

ALTER TABLE uk_emp_rag.legal_sources
  DROP CONSTRAINT IF EXISTS uk_emp_rag_legal_sources_trust_level_chk;
ALTER TABLE uk_emp_rag.legal_sources
  ADD CONSTRAINT uk_emp_rag_legal_sources_trust_level_chk CHECK (trust_level IN (
    'primary_law',
    'official_guidance',
    'tribunal_authority',
    'secondary_guidance'
  ));

-- End of 004_legal_rag_sprint10_source_registry.down.sql

-- =====================================================================
-- 010_legal_documents_statutory_seed.down.sql
-- =====================================================================
-- Removes the four statutory-document seed rows by deterministic id.
-- Does not touch any non-seed rows or other tables.
-- =====================================================================

DELETE FROM uk_emp_rag.legal_documents
WHERE id IN (
  '01900010-0010-4000-8000-000000000001'::uuid,
  '01900010-0010-4000-8000-000000000002'::uuid,
  '01900010-0010-4000-8000-000000000003'::uuid,
  '01900010-0010-4000-8000-000000000004'::uuid
);

-- End of 010_legal_documents_statutory_seed.down.sql

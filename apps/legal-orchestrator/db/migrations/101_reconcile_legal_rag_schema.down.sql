-- =====================================================================
-- 101_reconcile_legal_rag_schema.down.sql
-- =====================================================================
-- Reverse of 101_reconcile_legal_rag_schema.sql.
-- Drops the four additive reconciliation tables in dependency order.
-- =====================================================================

DROP TABLE IF EXISTS answer_verification_log CASCADE;
DROP TABLE IF EXISTS source_update_log CASCADE;
DROP TABLE IF EXISTS rag_runs CASCADE;
DROP TABLE IF EXISTS verified_answers_cache CASCADE;

-- End 101_reconcile_legal_rag_schema.down.sql

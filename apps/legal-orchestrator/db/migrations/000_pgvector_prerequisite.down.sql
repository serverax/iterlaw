-- =====================================================================
-- 000_pgvector_prerequisite.down.sql
-- =====================================================================
-- Removes the pgvector extension from the iterlaw database. Run only
-- when reverting the whole RAG schema (i.e. after rolling back 001+
-- and all later migrations). Dropping `vector` when columns of type
-- `vector(...)` still exist will FAIL — that is intentional. Do not
-- add CASCADE here.
-- =====================================================================

DROP EXTENSION IF EXISTS vector;

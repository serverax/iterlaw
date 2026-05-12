-- =====================================================================
-- 003_legal_rag_sprint9_uk_employment_core.down.sql
-- =====================================================================
-- Drops Sprint 9 UK employment core schema (uk_emp_rag) and helper function.
-- Safe to run if 003 forward was applied. Does NOT modify 001/002 public tables.
-- =====================================================================

DROP SCHEMA IF EXISTS uk_emp_rag CASCADE;

DROP FUNCTION IF EXISTS uk_emp_rag_set_updated_at();

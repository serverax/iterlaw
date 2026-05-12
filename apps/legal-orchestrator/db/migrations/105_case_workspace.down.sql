-- Down migration for 105_case_workspace.sql.
--
-- WARNING: this DROPs the user case-workspace tables. Safe only on a
-- dev database with no real user data. Drop order: dependents first.

DROP TABLE IF EXISTS public.legal_case_sources;
DROP TABLE IF EXISTS public.legal_case_timeline;
DROP TABLE IF EXISTS public.legal_case_drafts;
DROP TABLE IF EXISTS public.legal_case_documents;
DROP TABLE IF EXISTS public.legal_case_facts;
DROP TABLE IF EXISTS public.legal_case_records;

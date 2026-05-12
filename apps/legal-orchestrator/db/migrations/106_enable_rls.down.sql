-- Down migration for 106_enable_rls.sql.
--
-- Drops every policy this migration created, then disables RLS on the
-- nine user-data tables, then drops the helper functions. Safe on a
-- dev database; on a real DB this is a security regression and must
-- not run except as part of a controlled rebuild.

-- Drop policies (each wrapped so the down-migration is also idempotent).
DO $$
BEGIN
  DROP POLICY IF EXISTS users_self_select ON public.users;
  DROP POLICY IF EXISTS users_self_update ON public.users;
  DROP POLICY IF EXISTS users_admin_all ON public.users;

  DROP POLICY IF EXISTS workspaces_member_select ON public.workspaces;
  DROP POLICY IF EXISTS workspaces_admin_update ON public.workspaces;
  DROP POLICY IF EXISTS workspaces_admin_insert ON public.workspaces;

  DROP POLICY IF EXISTS workspace_members_member_select ON public.workspace_members;
  DROP POLICY IF EXISTS workspace_members_admin_write ON public.workspace_members;

  DROP POLICY IF EXISTS legal_case_records_member_select ON public.legal_case_records;
  DROP POLICY IF EXISTS legal_case_records_write ON public.legal_case_records;

  DROP POLICY IF EXISTS legal_case_facts_member_select ON public.legal_case_facts;
  DROP POLICY IF EXISTS legal_case_facts_write ON public.legal_case_facts;

  DROP POLICY IF EXISTS legal_case_documents_member_select ON public.legal_case_documents;
  DROP POLICY IF EXISTS legal_case_documents_write ON public.legal_case_documents;

  DROP POLICY IF EXISTS legal_case_drafts_member_select ON public.legal_case_drafts;
  DROP POLICY IF EXISTS legal_case_drafts_write ON public.legal_case_drafts;

  DROP POLICY IF EXISTS legal_case_timeline_member_select ON public.legal_case_timeline;
  DROP POLICY IF EXISTS legal_case_timeline_write ON public.legal_case_timeline;

  DROP POLICY IF EXISTS legal_case_sources_member_select ON public.legal_case_sources;
  DROP POLICY IF EXISTS legal_case_sources_write ON public.legal_case_sources;
END $$;

ALTER TABLE public.users               DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_case_records  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_case_facts    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_case_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_case_drafts   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_case_timeline DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_case_sources  DISABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS public.current_user_can_write_case(UUID, UUID);
DROP FUNCTION IF EXISTS public.current_user_can_write_workspace(UUID);
DROP FUNCTION IF EXISTS public.current_user_in_workspace(UUID);
DROP FUNCTION IF EXISTS public.current_app_user_is_admin();
DROP FUNCTION IF EXISTS public.current_app_user_role();
DROP FUNCTION IF EXISTS public.current_app_user_id();

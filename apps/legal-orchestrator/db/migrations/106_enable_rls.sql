-- =====================================================================
-- 106_enable_rls.sql
-- =====================================================================
-- IterLaw — Row-Level Security on the user-data tables added by 104
-- and 105. Corpus tables (legal_sources, legal_documents, legal_chunks,
-- legal_cases, etc.) are SHARED knowledge and intentionally NOT
-- protected by RLS.
--
-- Pattern
-- -------
-- The application connects as a Postgres role that has RLS enforced.
-- At the start of every request the server sets two session GUCs:
--
--   SET LOCAL app.user_id   = '<authenticated user UUID>';
--   SET LOCAL app.user_role = '<role>';   -- 'admin' for staff / null
--                                          -- for end-users / 'service'
--                                          -- for internal jobs.
--
-- If `app.user_id` is unset the policies return FALSE and no row is
-- visible — fail-closed.
--
-- A separate Postgres role with BYPASSRLS is intended for migration
-- runners and audit jobs only. It is NOT created here (operator
-- decision; document only).
--
-- Idempotency contract
-- --------------------
--   * ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent in
--     Postgres (re-running is a no-op).
--   * CREATE POLICY is NOT idempotent in plain SQL; each policy is
--     wrapped in a DO $$ ... IF NOT EXISTS ... CREATE POLICY $$ block
--     so this migration is safe to re-run.
--   * No DROP, no DELETE, no TRUNCATE, no destructive ALTER.
--
-- What this migration does NOT do
-- -------------------------------
--   * Does not enable RLS on any corpus / RAG / audit table from
--     001-010 or 101 or 102. Those remain shared.
--   * Does not create Postgres roles. The `service_role` with
--     BYPASSRLS, and the per-request `app_user` role, are operator
--     decisions documented in SPRINT_10_LIVE_DB_CLOSEOUT_OPERATOR_CHECKLIST.md.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------

-- Returns the request's authenticated user id, or NULL if the GUC is
-- unset / empty / unparseable. Marked STABLE so the planner can cache
-- it within a single query.
CREATE OR REPLACE FUNCTION public.current_app_user_id() RETURNS UUID
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_raw TEXT;
BEGIN
  v_raw := current_setting('app.user_id', true);
  IF v_raw IS NULL OR v_raw = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN v_raw::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;
END $$;

-- Returns the request's role string ('admin', 'service', or 'user'),
-- defaulting to 'user'.
CREATE OR REPLACE FUNCTION public.current_app_user_role() RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT coalesce(NULLIF(current_setting('app.user_role', true), ''), 'user');
$$;

CREATE OR REPLACE FUNCTION public.current_app_user_is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT public.current_app_user_role() = 'admin';
$$;

-- Returns TRUE when the current user is an active member of the
-- given workspace. Used as the SELECT/UPDATE/DELETE qualifier on
-- every workspace-scoped table.
CREATE OR REPLACE FUNCTION public.current_user_in_workspace(p_workspace_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT public.current_app_user_is_admin()
      OR EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = p_workspace_id
          AND wm.user_id = public.current_app_user_id()
          AND wm.status = 'active'
      );
$$;

-- Returns TRUE when the current user has at least the given write
-- role in the given workspace. Editor / owner / admin / solicitor
-- can write; viewer cannot. Used as the WITH CHECK qualifier on
-- INSERT/UPDATE.
CREATE OR REPLACE FUNCTION public.current_user_can_write_workspace(p_workspace_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT public.current_app_user_is_admin()
      OR EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = p_workspace_id
          AND wm.user_id = public.current_app_user_id()
          AND wm.status = 'active'
          AND wm.role IN ('owner', 'admin', 'editor', 'solicitor')
      );
$$;

-- Solicitor write-on-assigned: TRUE if user is non-solicitor writer,
-- OR is a solicitor AND the row's assigned_user_id matches.
CREATE OR REPLACE FUNCTION public.current_user_can_write_case(p_workspace_id UUID, p_assigned_user_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT public.current_app_user_is_admin()
      OR EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = p_workspace_id
          AND wm.user_id = public.current_app_user_id()
          AND wm.status = 'active'
          AND (
            wm.role IN ('owner', 'admin', 'editor')
            OR (wm.role = 'solicitor' AND p_assigned_user_id = public.current_app_user_id())
          )
      );
$$;

-- Helper to create a policy idempotently (no native IF NOT EXISTS
-- for CREATE POLICY).
DO $$ BEGIN END $$;

-- ---------------------------------------------------------------------
-- ENABLE RLS on every user-data table
-- ---------------------------------------------------------------------
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_case_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_case_facts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_case_drafts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_case_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_case_sources  ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- Policies (idempotent via DO $$ pg_policies check $$)
-- ---------------------------------------------------------------------

-- users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_self_select') THEN
    EXECUTE 'CREATE POLICY users_self_select ON public.users FOR SELECT USING (id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_self_update') THEN
    EXECUTE 'CREATE POLICY users_self_update ON public.users FOR UPDATE USING (id = public.current_app_user_id() OR public.current_app_user_is_admin()) WITH CHECK (id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_admin_all') THEN
    EXECUTE 'CREATE POLICY users_admin_all ON public.users FOR ALL USING (public.current_app_user_is_admin()) WITH CHECK (public.current_app_user_is_admin())';
  END IF;
END $$;

-- workspaces
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspaces' AND policyname = 'workspaces_member_select') THEN
    EXECUTE 'CREATE POLICY workspaces_member_select ON public.workspaces FOR SELECT USING (public.current_user_in_workspace(id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspaces' AND policyname = 'workspaces_admin_update') THEN
    EXECUTE 'CREATE POLICY workspaces_admin_update ON public.workspaces FOR UPDATE USING (public.current_user_can_write_workspace(id)) WITH CHECK (public.current_user_can_write_workspace(id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspaces' AND policyname = 'workspaces_admin_insert') THEN
    EXECUTE 'CREATE POLICY workspaces_admin_insert ON public.workspaces FOR INSERT WITH CHECK (public.current_app_user_is_admin() OR owner_user_id = public.current_app_user_id())';
  END IF;
END $$;

-- workspace_members
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_members' AND policyname = 'workspace_members_member_select') THEN
    EXECUTE 'CREATE POLICY workspace_members_member_select ON public.workspace_members FOR SELECT USING (public.current_user_in_workspace(workspace_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_members' AND policyname = 'workspace_members_admin_write') THEN
    EXECUTE 'CREATE POLICY workspace_members_admin_write ON public.workspace_members FOR ALL USING (public.current_user_can_write_workspace(workspace_id)) WITH CHECK (public.current_user_can_write_workspace(workspace_id))';
  END IF;
END $$;

-- legal_case_records
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_case_records' AND policyname = 'legal_case_records_member_select') THEN
    EXECUTE 'CREATE POLICY legal_case_records_member_select ON public.legal_case_records FOR SELECT USING (public.current_user_in_workspace(workspace_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_case_records' AND policyname = 'legal_case_records_write') THEN
    EXECUTE 'CREATE POLICY legal_case_records_write ON public.legal_case_records FOR ALL USING (public.current_user_can_write_case(workspace_id, assigned_user_id)) WITH CHECK (public.current_user_can_write_case(workspace_id, assigned_user_id))';
  END IF;
END $$;

-- Child tables share the case's workspace_id. Solicitor scoping is
-- enforced by the parent's assigned_user_id via a join in the policy.

-- legal_case_facts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_case_facts' AND policyname = 'legal_case_facts_member_select') THEN
    EXECUTE 'CREATE POLICY legal_case_facts_member_select ON public.legal_case_facts FOR SELECT USING (public.current_user_in_workspace(workspace_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_case_facts' AND policyname = 'legal_case_facts_write') THEN
    EXECUTE 'CREATE POLICY legal_case_facts_write ON public.legal_case_facts FOR ALL USING (EXISTS (SELECT 1 FROM public.legal_case_records r WHERE r.id = legal_case_facts.case_id AND public.current_user_can_write_case(r.workspace_id, r.assigned_user_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.legal_case_records r WHERE r.id = legal_case_facts.case_id AND public.current_user_can_write_case(r.workspace_id, r.assigned_user_id)))';
  END IF;
END $$;

-- legal_case_documents
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_case_documents' AND policyname = 'legal_case_documents_member_select') THEN
    EXECUTE 'CREATE POLICY legal_case_documents_member_select ON public.legal_case_documents FOR SELECT USING (public.current_user_in_workspace(workspace_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_case_documents' AND policyname = 'legal_case_documents_write') THEN
    EXECUTE 'CREATE POLICY legal_case_documents_write ON public.legal_case_documents FOR ALL USING (EXISTS (SELECT 1 FROM public.legal_case_records r WHERE r.id = legal_case_documents.case_id AND public.current_user_can_write_case(r.workspace_id, r.assigned_user_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.legal_case_records r WHERE r.id = legal_case_documents.case_id AND public.current_user_can_write_case(r.workspace_id, r.assigned_user_id)))';
  END IF;
END $$;

-- legal_case_drafts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_case_drafts' AND policyname = 'legal_case_drafts_member_select') THEN
    EXECUTE 'CREATE POLICY legal_case_drafts_member_select ON public.legal_case_drafts FOR SELECT USING (public.current_user_in_workspace(workspace_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_case_drafts' AND policyname = 'legal_case_drafts_write') THEN
    EXECUTE 'CREATE POLICY legal_case_drafts_write ON public.legal_case_drafts FOR ALL USING (EXISTS (SELECT 1 FROM public.legal_case_records r WHERE r.id = legal_case_drafts.case_id AND public.current_user_can_write_case(r.workspace_id, r.assigned_user_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.legal_case_records r WHERE r.id = legal_case_drafts.case_id AND public.current_user_can_write_case(r.workspace_id, r.assigned_user_id)))';
  END IF;
END $$;

-- legal_case_timeline
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_case_timeline' AND policyname = 'legal_case_timeline_member_select') THEN
    EXECUTE 'CREATE POLICY legal_case_timeline_member_select ON public.legal_case_timeline FOR SELECT USING (public.current_user_in_workspace(workspace_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_case_timeline' AND policyname = 'legal_case_timeline_write') THEN
    EXECUTE 'CREATE POLICY legal_case_timeline_write ON public.legal_case_timeline FOR ALL USING (EXISTS (SELECT 1 FROM public.legal_case_records r WHERE r.id = legal_case_timeline.case_id AND public.current_user_can_write_case(r.workspace_id, r.assigned_user_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.legal_case_records r WHERE r.id = legal_case_timeline.case_id AND public.current_user_can_write_case(r.workspace_id, r.assigned_user_id)))';
  END IF;
END $$;

-- legal_case_sources
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_case_sources' AND policyname = 'legal_case_sources_member_select') THEN
    EXECUTE 'CREATE POLICY legal_case_sources_member_select ON public.legal_case_sources FOR SELECT USING (public.current_user_in_workspace(workspace_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_case_sources' AND policyname = 'legal_case_sources_write') THEN
    EXECUTE 'CREATE POLICY legal_case_sources_write ON public.legal_case_sources FOR ALL USING (EXISTS (SELECT 1 FROM public.legal_case_records r WHERE r.id = legal_case_sources.case_id AND public.current_user_can_write_case(r.workspace_id, r.assigned_user_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.legal_case_records r WHERE r.id = legal_case_sources.case_id AND public.current_user_can_write_case(r.workspace_id, r.assigned_user_id)))';
  END IF;
END $$;

COMMENT ON FUNCTION public.current_app_user_id() IS
  'IterLaw RLS helper. Reads app.user_id GUC; returns NULL if unset/empty/unparseable. Fail-closed.';
COMMENT ON FUNCTION public.current_user_in_workspace(UUID) IS
  'IterLaw RLS helper. TRUE if current user is an active workspace_member OR admin.';
COMMENT ON FUNCTION public.current_user_can_write_workspace(UUID) IS
  'IterLaw RLS helper. TRUE if current user has owner/admin/editor/solicitor role in workspace OR is admin.';
COMMENT ON FUNCTION public.current_user_can_write_case(UUID, UUID) IS
  'IterLaw RLS helper. Same as can_write_workspace but solicitor role is restricted to cases where assigned_user_id matches.';

-- =====================================================================
-- 144_sprint48_workspace_rbac_phase4.sql
-- =====================================================================
-- Sprint 48 — Declarative workspace role permissions (schema-level).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.workspace_role_permissions (
  role          public.workspace_member_role_kind NOT NULL,
  permission    VARCHAR(64) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission)
);

CREATE INDEX IF NOT EXISTS idx_workspace_role_permissions_role
  ON public.workspace_role_permissions (role);

CREATE INDEX IF NOT EXISTS idx_workspace_role_permissions_perm
  ON public.workspace_role_permissions (permission);

COMMENT ON TABLE public.workspace_role_permissions IS
  'Sprint 48 — RBAC permission matrix (public read).';

ALTER TABLE public.workspace_role_permissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_role_permissions' AND policyname = 'workspace_role_permissions_public_select') THEN
    EXECUTE 'CREATE POLICY workspace_role_permissions_public_select ON public.workspace_role_permissions FOR SELECT USING (true)';
  END IF;
END $$;

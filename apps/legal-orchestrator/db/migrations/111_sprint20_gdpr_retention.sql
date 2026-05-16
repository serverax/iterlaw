-- =====================================================================
-- 111_sprint20_gdpr_retention.sql
-- =====================================================================
-- Sprint 20 — GDPR retention catalog + data-subject request (DSR) queue.
--
-- data_retention_policies: admin-managed retention windows per resource.
-- gdpr_subject_requests: EXPORT / ERASURE / RECTIFICATION lifecycle rows.
--
-- RLS: policies table admin-only; DSR rows visible to owning user + admin.
-- Idempotent.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type       TEXT NOT NULL,
  category              TEXT NOT NULL DEFAULT 'DEFAULT',
  retention_days        INT NOT NULL CHECK (retention_days > 0),
  description           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT data_retention_policies_resource_cat UNIQUE (resource_type, category)
);

CREATE INDEX IF NOT EXISTS idx_data_retention_policies_resource
  ON public.data_retention_policies (resource_type);

COMMENT ON TABLE public.data_retention_policies IS
  'Catalog of retention windows for GDPR-aligned purging (Sprint 20).';

CREATE TABLE IF NOT EXISTS public.gdpr_subject_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  request_type          TEXT NOT NULL CHECK (request_type IN ('EXPORT', 'ERASURE', 'RECTIFICATION')),
  status                TEXT NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED')),
  payload_ref           TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gdpr_subject_requests_user_id
  ON public.gdpr_subject_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gdpr_subject_requests_status
  ON public.gdpr_subject_requests (status, created_at DESC);

COMMENT ON TABLE public.gdpr_subject_requests IS
  'GDPR Art. 15/17/16-style subject requests (Sprint 20; operational queue).';

ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gdpr_subject_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'data_retention_policies' AND policyname = 'data_retention_policies_admin_all') THEN
    EXECUTE 'CREATE POLICY data_retention_policies_admin_all ON public.data_retention_policies FOR ALL USING (public.current_app_user_is_admin()) WITH CHECK (public.current_app_user_is_admin())';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gdpr_subject_requests' AND policyname = 'gdpr_subject_requests_self_select') THEN
    EXECUTE 'CREATE POLICY gdpr_subject_requests_self_select ON public.gdpr_subject_requests FOR SELECT USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gdpr_subject_requests' AND policyname = 'gdpr_subject_requests_self_insert') THEN
    EXECUTE 'CREATE POLICY gdpr_subject_requests_self_insert ON public.gdpr_subject_requests FOR INSERT WITH CHECK (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gdpr_subject_requests' AND policyname = 'gdpr_subject_requests_admin_update') THEN
    EXECUTE 'CREATE POLICY gdpr_subject_requests_admin_update ON public.gdpr_subject_requests FOR UPDATE USING (public.current_app_user_is_admin()) WITH CHECK (public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gdpr_subject_requests' AND policyname = 'gdpr_subject_requests_admin_delete') THEN
    EXECUTE 'CREATE POLICY gdpr_subject_requests_admin_delete ON public.gdpr_subject_requests FOR DELETE USING (public.current_app_user_is_admin())';
  END IF;
END $$;

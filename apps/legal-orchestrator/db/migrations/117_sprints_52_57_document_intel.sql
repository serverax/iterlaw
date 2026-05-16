-- =====================================================================
-- 117_sprints_52_57_document_intel.sql
-- =====================================================================
-- Sprints 52–57: document uploads, extracted entities, semantic chunks.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.document_uploads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  uploaded_by     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mime_type       TEXT NOT NULL,
  storage_key     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'parsed', 'failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_uploads_workspace
  ON public.document_uploads (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.document_entities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id       UUID NOT NULL REFERENCES public.document_uploads(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,
  entity_text     TEXT NOT NULL,
  span_start      INT NOT NULL CHECK (span_start >= 0),
  span_end        INT NOT NULL CHECK (span_end >= span_start),
  confidence      NUMERIC NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_document_entities_upload
  ON public.document_entities (upload_id);

CREATE INDEX IF NOT EXISTS idx_document_entities_text_trgm
  ON public.document_entities USING gin (entity_text gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.document_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id       UUID NOT NULL REFERENCES public.document_uploads(id) ON DELETE CASCADE,
  chunk_index     INT NOT NULL CHECK (chunk_index >= 0),
  chunk_text      TEXT NOT NULL,
  embedding_ref   UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_chunks_upload_idx UNIQUE (upload_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_upload
  ON public.document_chunks (upload_id, chunk_index);

ALTER TABLE public.document_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_uploads' AND policyname = 'document_uploads_ws_select') THEN
    EXECUTE 'CREATE POLICY document_uploads_ws_select ON public.document_uploads FOR SELECT USING (public.current_user_in_workspace(workspace_id) OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_uploads' AND policyname = 'document_uploads_ws_insert') THEN
    EXECUTE 'CREATE POLICY document_uploads_ws_insert ON public.document_uploads FOR INSERT WITH CHECK (uploaded_by = public.current_app_user_id() AND public.current_user_in_workspace(workspace_id))';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_entities' AND policyname = 'document_entities_ws_select') THEN
    EXECUTE 'CREATE POLICY document_entities_ws_select ON public.document_entities FOR SELECT USING (EXISTS (SELECT 1 FROM public.document_uploads u WHERE u.id = upload_id AND public.current_user_in_workspace(u.workspace_id)) OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_entities' AND policyname = 'document_entities_ws_write') THEN
    EXECUTE 'CREATE POLICY document_entities_ws_write ON public.document_entities FOR ALL USING (EXISTS (SELECT 1 FROM public.document_uploads u WHERE u.id = upload_id AND public.current_user_can_write_workspace(u.workspace_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.document_uploads u WHERE u.id = upload_id AND public.current_user_can_write_workspace(u.workspace_id)))';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_chunks' AND policyname = 'document_chunks_ws_select') THEN
    EXECUTE 'CREATE POLICY document_chunks_ws_select ON public.document_chunks FOR SELECT USING (EXISTS (SELECT 1 FROM public.document_uploads u WHERE u.id = upload_id AND public.current_user_in_workspace(u.workspace_id)) OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'document_chunks' AND policyname = 'document_chunks_ws_write') THEN
    EXECUTE 'CREATE POLICY document_chunks_ws_write ON public.document_chunks FOR ALL USING (EXISTS (SELECT 1 FROM public.document_uploads u WHERE u.id = upload_id AND public.current_user_can_write_workspace(u.workspace_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.document_uploads u WHERE u.id = upload_id AND public.current_user_can_write_workspace(u.workspace_id)))';
  END IF;
END $$;

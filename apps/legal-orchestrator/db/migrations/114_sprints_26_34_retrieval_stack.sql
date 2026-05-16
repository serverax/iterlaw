-- =====================================================================
-- 114_sprints_26_34_retrieval_stack.sql
-- =====================================================================
-- Sprints 26–34: HNSW registry metadata, Ollama response cache, streaming
-- chunk outbox (date-ordered; BRIN-ready for large volume).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.retrieval_hnsw_registry (
  index_name          TEXT PRIMARY KEY,
  embedding_model     TEXT NOT NULL,
  lists               INT NOT NULL CHECK (lists > 0),
  m                   INT NOT NULL CHECK (m > 0),
  ef_construction     INT NOT NULL CHECK (ef_construction > 0),
  dimensions          INT NOT NULL CHECK (dimensions > 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ollama_inference_cache (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  model             TEXT NOT NULL,
  prompt_hash       TEXT NOT NULL,
  response_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ollama_inference_cache_user_model
  ON public.ollama_inference_cache (user_id, model, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ollama_inference_cache_expires
  ON public.ollama_inference_cache (expires_at);

CREATE TABLE IF NOT EXISTS public.streaming_chunk_outbox (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  request_id      UUID NOT NULL,
  seq             INT NOT NULL CHECK (seq >= 0),
  chunk_text      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT streaming_chunk_outbox_req_seq UNIQUE (request_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_streaming_chunk_outbox_request
  ON public.streaming_chunk_outbox (request_id, seq);

CREATE INDEX IF NOT EXISTS idx_streaming_chunk_outbox_created_brin
  ON public.streaming_chunk_outbox USING brin (created_at);

ALTER TABLE public.retrieval_hnsw_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ollama_inference_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaming_chunk_outbox ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'retrieval_hnsw_registry' AND policyname = 'retrieval_hnsw_registry_admin_all') THEN
    EXECUTE 'CREATE POLICY retrieval_hnsw_registry_admin_all ON public.retrieval_hnsw_registry FOR ALL USING (public.current_app_user_is_admin()) WITH CHECK (public.current_app_user_is_admin())';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ollama_inference_cache' AND policyname = 'ollama_inference_cache_self_select') THEN
    EXECUTE 'CREATE POLICY ollama_inference_cache_self_select ON public.ollama_inference_cache FOR SELECT USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ollama_inference_cache' AND policyname = 'ollama_inference_cache_self_insert') THEN
    EXECUTE 'CREATE POLICY ollama_inference_cache_self_insert ON public.ollama_inference_cache FOR INSERT WITH CHECK (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ollama_inference_cache' AND policyname = 'ollama_inference_cache_admin_delete') THEN
    EXECUTE 'CREATE POLICY ollama_inference_cache_admin_delete ON public.ollama_inference_cache FOR DELETE USING (public.current_app_user_is_admin())';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'streaming_chunk_outbox' AND policyname = 'streaming_chunk_outbox_ws_select') THEN
    EXECUTE 'CREATE POLICY streaming_chunk_outbox_ws_select ON public.streaming_chunk_outbox FOR SELECT USING (public.current_user_in_workspace(workspace_id) OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'streaming_chunk_outbox' AND policyname = 'streaming_chunk_outbox_ws_insert') THEN
    EXECUTE 'CREATE POLICY streaming_chunk_outbox_ws_insert ON public.streaming_chunk_outbox FOR INSERT WITH CHECK (user_id = public.current_app_user_id() AND public.current_user_in_workspace(workspace_id))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'streaming_chunk_outbox' AND policyname = 'streaming_chunk_outbox_admin_delete') THEN
    EXECUTE 'CREATE POLICY streaming_chunk_outbox_admin_delete ON public.streaming_chunk_outbox FOR DELETE USING (public.current_app_user_is_admin())';
  END IF;
END $$;

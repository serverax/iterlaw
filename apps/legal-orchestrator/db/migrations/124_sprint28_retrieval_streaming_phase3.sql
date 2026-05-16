-- =====================================================================
-- 124_sprint28_retrieval_streaming_phase3.sql
-- =====================================================================
-- Sprint 28 — Streaming response queue (Zone 1) for chunked Ollama-style
-- output keyed by request_id + chunk_sequence.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.retrieval_streaming_response_queue (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  request_id       UUID NOT NULL,
  chunk_sequence   INT NOT NULL CHECK (chunk_sequence >= 0),
  chunk_text       TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT retrieval_streaming_response_queue_req_seq UNIQUE (request_id, chunk_sequence)
);

CREATE INDEX IF NOT EXISTS idx_retrieval_streaming_user_created
  ON public.retrieval_streaming_response_queue (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_retrieval_streaming_request_created
  ON public.retrieval_streaming_response_queue (request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_retrieval_streaming_created
  ON public.retrieval_streaming_response_queue (created_at DESC);

COMMENT ON TABLE public.retrieval_streaming_response_queue IS
  'Sprint 28 — streaming chunk queue rows (user-scoped).';

ALTER TABLE public.retrieval_streaming_response_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'retrieval_streaming_response_queue' AND policyname = 'retrieval_streaming_queue_self_select') THEN
    EXECUTE 'CREATE POLICY retrieval_streaming_queue_self_select ON public.retrieval_streaming_response_queue FOR SELECT USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'retrieval_streaming_response_queue' AND policyname = 'retrieval_streaming_queue_self_insert') THEN
    EXECUTE 'CREATE POLICY retrieval_streaming_queue_self_insert ON public.retrieval_streaming_response_queue FOR INSERT WITH CHECK (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'retrieval_streaming_response_queue' AND policyname = 'retrieval_streaming_queue_admin_delete') THEN
    EXECUTE 'CREATE POLICY retrieval_streaming_queue_admin_delete ON public.retrieval_streaming_response_queue FOR DELETE USING (public.current_app_user_is_admin())';
  END IF;
END $$;

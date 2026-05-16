-- =====================================================================
-- 123_sprint27_retrieval_ollama_phase2.sql
-- =====================================================================
-- Sprint 27 — Ollama inference cache (Phase 2): rows keyed by user/model/
-- prompt_hash with merged TTL from Zone 1 + Zone 2 stub policy.
-- Complements public.ollama_inference_cache (migration 114).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.retrieval_ollama_inference_cache (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id      UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  model             TEXT NOT NULL,
  prompt_hash       TEXT NOT NULL,
  response_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  zone1_ttl_ms      BIGINT NOT NULL CHECK (zone1_ttl_ms > 0),
  zone2_ttl_ms      BIGINT NOT NULL CHECK (zone2_ttl_ms > 0),
  merged_ttl_ms     BIGINT NOT NULL CHECK (merged_ttl_ms > 0),
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retrieval_ollama_cache_user_model
  ON public.retrieval_ollama_inference_cache (user_id, model, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_retrieval_ollama_cache_expires
  ON public.retrieval_ollama_inference_cache (expires_at);

COMMENT ON TABLE public.retrieval_ollama_inference_cache IS
  'Sprint 27 — Ollama inference cache rows with merged TTL (Zone 1 + Zone 2 stub).';

ALTER TABLE public.retrieval_ollama_inference_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'retrieval_ollama_inference_cache' AND policyname = 'retrieval_ollama_cache_self_select') THEN
    EXECUTE 'CREATE POLICY retrieval_ollama_cache_self_select ON public.retrieval_ollama_inference_cache FOR SELECT USING (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'retrieval_ollama_inference_cache' AND policyname = 'retrieval_ollama_cache_self_insert') THEN
    EXECUTE 'CREATE POLICY retrieval_ollama_cache_self_insert ON public.retrieval_ollama_inference_cache FOR INSERT WITH CHECK (user_id = public.current_app_user_id() OR public.current_app_user_is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'retrieval_ollama_inference_cache' AND policyname = 'retrieval_ollama_cache_admin_delete') THEN
    EXECUTE 'CREATE POLICY retrieval_ollama_cache_admin_delete ON public.retrieval_ollama_inference_cache FOR DELETE USING (public.current_app_user_is_admin())';
  END IF;
END $$;

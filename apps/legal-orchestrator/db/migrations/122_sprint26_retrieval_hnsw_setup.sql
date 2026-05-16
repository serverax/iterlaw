-- =====================================================================
-- 122_sprint26_retrieval_hnsw_setup.sql
-- =====================================================================
-- Sprint 26 — Speed-First Retrieval Phase 1: canonical HNSW lane profiles
-- (build parameters per logical index; complements 114 registry metadata).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.retrieval_hnsw_lane_profiles (
  lane_id             TEXT PRIMARY KEY,
  index_name          TEXT NOT NULL UNIQUE,
  dimensions          INT NOT NULL CHECK (dimensions > 0),
  distance            TEXT NOT NULL CHECK (distance IN ('cosine', 'l2', 'ip')),
  lists               INT NOT NULL CHECK (lists > 0),
  m                   INT NOT NULL CHECK (m > 0),
  ef_construction     INT NOT NULL CHECK (ef_construction > 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.retrieval_hnsw_lane_profiles IS
  'Sprint 26 — default HNSW build parameters per retrieval lane (Zone 1 catalog).';

CREATE INDEX IF NOT EXISTS idx_retrieval_hnsw_lane_profiles_index_name
  ON public.retrieval_hnsw_lane_profiles (index_name);

ALTER TABLE public.retrieval_hnsw_lane_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'retrieval_hnsw_lane_profiles' AND policyname = 'retrieval_hnsw_lane_profiles_admin_all') THEN
    EXECUTE 'CREATE POLICY retrieval_hnsw_lane_profiles_admin_all ON public.retrieval_hnsw_lane_profiles FOR ALL USING (public.current_app_user_is_admin()) WITH CHECK (public.current_app_user_is_admin())';
  END IF;
END $$;

INSERT INTO public.retrieval_hnsw_lane_profiles (
  lane_id, index_name, dimensions, distance, lists, m, ef_construction
) VALUES (
  'UK_EMP_LEGAL_CHUNKS_PRIMARY',
  'legal_chunks_embedding_hnsw_primary',
  1536,
  'cosine',
  64,
  16,
  200
) ON CONFLICT (lane_id) DO NOTHING;

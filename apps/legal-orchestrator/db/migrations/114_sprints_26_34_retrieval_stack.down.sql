DROP POLICY IF EXISTS streaming_chunk_outbox_admin_delete ON public.streaming_chunk_outbox;
DROP POLICY IF EXISTS streaming_chunk_outbox_ws_insert ON public.streaming_chunk_outbox;
DROP POLICY IF EXISTS streaming_chunk_outbox_ws_select ON public.streaming_chunk_outbox;

DROP POLICY IF EXISTS ollama_inference_cache_admin_delete ON public.ollama_inference_cache;
DROP POLICY IF EXISTS ollama_inference_cache_self_insert ON public.ollama_inference_cache;
DROP POLICY IF EXISTS ollama_inference_cache_self_select ON public.ollama_inference_cache;

DROP POLICY IF EXISTS retrieval_hnsw_registry_admin_all ON public.retrieval_hnsw_registry;

DROP TABLE IF EXISTS public.streaming_chunk_outbox;
DROP TABLE IF EXISTS public.ollama_inference_cache;
DROP TABLE IF EXISTS public.retrieval_hnsw_registry;

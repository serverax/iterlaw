DROP POLICY IF EXISTS document_chunks_ws_write ON public.document_chunks;
DROP POLICY IF EXISTS document_chunks_ws_select ON public.document_chunks;
DROP POLICY IF EXISTS document_entities_ws_write ON public.document_entities;
DROP POLICY IF EXISTS document_entities_ws_select ON public.document_entities;
DROP POLICY IF EXISTS document_uploads_ws_insert ON public.document_uploads;
DROP POLICY IF EXISTS document_uploads_ws_select ON public.document_uploads;

DROP TABLE IF EXISTS public.document_chunks;
DROP TABLE IF EXISTS public.document_entities;
DROP TABLE IF EXISTS public.document_uploads;

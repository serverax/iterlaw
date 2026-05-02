-- documents: uploaded letters; sensitive columns app-encrypted before write (Week 3)

CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  -- ENCRYPTED at application level before write (AES-256-GCM via Azure Key Vault)
  extracted_text TEXT,
  -- ENCRYPTED at application level before write
  analysis_result JSONB,
  upload_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  image_deletion_scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_isolation ON public.documents
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_documents_case_id ON public.documents (case_id);
CREATE INDEX idx_documents_user_id ON public.documents (user_id);
CREATE INDEX idx_documents_deletion ON public.documents (image_deletion_scheduled_for)
  WHERE image_deletion_scheduled_for IS NOT NULL;

COMMENT ON COLUMN public.documents.extracted_text IS 'ENCRYPTED at application level before storage.';
COMMENT ON COLUMN public.documents.analysis_result IS 'ENCRYPTED at application level before storage.';

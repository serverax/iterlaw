export type LlmGatewayMode = "disabled" | "ollama" | "llama_cpp" | "bifrost";

export type LlmGatewayStatus = {
  configured: boolean;
  mode: LlmGatewayMode;
  available: boolean;
  reason?:
    | "DISABLED"
    | "OLLAMA_UNAVAILABLE"
    | "LLAMA_CPP_UNAVAILABLE"
    | "BIFROST_UNAVAILABLE"
    | "CONFIG_MISSING";
};

export type RetrievedLegalChunkForSynthesis = {
  chunkId: string;
  documentId: string;
  title: string;
  url: string;
  citationLabel: string;
  text: string;
  authorityLevel?: string;
  sourceType?: string;
  effectiveDate?: string;
  applicableTo?: string | null;
};

export type BoundedSynthesisInput = {
  question: string;
  facts: Record<string, unknown>;
  retrievedChunks: RetrievedLegalChunkForSynthesis[];
};

export type BoundedSynthesisCitation = {
  chunkId: string;
  documentId: string;
  title: string;
  url: string;
  citationLabel: string;
};

export type BoundedSynthesisOutput = {
  status:
    | "synthesised"
    | "llm_unavailable"
    | "insufficient_sources"
    | "citation_failed"
    | "blocked_by_policy";
  answer?: string;
  citations: BoundedSynthesisCitation[];
  model?: string;
  safetyNotes: string[];
};

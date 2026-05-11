// rag/ — public surface for the legal retrieval layer.
// Implementation in postgresRetrieval.ts + mockRetrieval.ts; type
// contracts in rag.types.ts; port shape in retrieval.port.ts.

export type {
  CorpusSourceType,
  LegalCorpusDocument,
  LegalChunk,
  LegalCitation,
  RetrievalQuery,
  RetrievalResult,
} from "./rag.types";

export type { RetrievalPort, RetrievalPortResult, RetrievedLegalChunk } from "./retrieval.port";

export { PostgresRetrieval, mapRowToRetrievedLegalChunk } from "./postgresRetrieval";
export type { PostgresRetrievalConfig } from "./postgresRetrieval";

export { MockRetrieval, SAMPLE_UK_EMPLOYMENT_CORPUS } from "./mockRetrieval";
export type { MockCorpusChunk, MockRetrievalOptions } from "./mockRetrieval";

export { createRagService } from "./rag.service";
export type { RagService, RagServiceConfig } from "./rag.service";

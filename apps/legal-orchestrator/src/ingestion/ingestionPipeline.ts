import type { LegalDocumentChunk, NormalisedLegalDocument, RawLegalDocument, TrustedSource } from "./types";
import { chunkLegalDocument } from "./chunkDocument";
import { normaliseDocument } from "./normalizeDocument";
import { extractCitations } from "./citationExtractor";
import { validateTrustedSource } from "./sourceRegistry";

export interface IngestionRepository {
  upsertDocument(doc: NormalisedLegalDocument): Promise<void>;
  upsertChunks(doc: NormalisedLegalDocument, chunks: LegalDocumentChunk[]): Promise<void>;
}

export interface IngestionPipelineInput {
  source: TrustedSource;
  documents: RawLegalDocument[];
}

export interface IngestionPipelineOptions {
  dryRun?: boolean;
  repository?: IngestionRepository;
}

export interface IngestionPipelineError {
  code: string;
  documentIndex?: number;
}

export interface IngestionPipelineResult {
  dryRun: boolean;
  status: "ok" | "partial" | "untrusted_source" | "no_documents";
  documentsSeen: number;
  documentsNormalised: number;
  chunksCreated: number;
  citationsExtracted: number;
  errors: IngestionPipelineError[];
}

export async function runIngestionPipeline(
  input: IngestionPipelineInput,
  opts: IngestionPipelineOptions = {}
): Promise<IngestionPipelineResult> {
  const dryRun = opts.dryRun !== false;
  const repo = opts.repository;
  const errors: IngestionPipelineError[] = [];

  const srcCheck = validateTrustedSource(input.source);
  if (!srcCheck.ok) {
    return {
      dryRun,
      status: "untrusted_source",
      documentsSeen: input.documents.length,
      documentsNormalised: 0,
      chunksCreated: 0,
      citationsExtracted: 0,
      errors: [{ code: srcCheck.code }],
    };
  }

  if (input.documents.length === 0) {
    return {
      dryRun,
      status: "no_documents",
      documentsSeen: 0,
      documentsNormalised: 0,
      chunksCreated: 0,
      citationsExtracted: 0,
      errors: [],
    };
  }

  let documentsNormalised = 0;
  let chunksCreated = 0;
  let citationsExtracted = 0;

  for (let i = 0; i < input.documents.length; i++) {
    const raw = input.documents[i]!;
    const norm = normaliseDocument(raw, input.source);
    if (!norm.ok) {
      errors.push({ code: norm.code, documentIndex: i });
      continue;
    }
    documentsNormalised++;
    const chunks = chunkLegalDocument(norm.document);
    chunksCreated += chunks.length;
    const cites = extractCitations(norm.document, chunks);
    citationsExtracted += cites.length;

    if (!dryRun && repo) {
      await repo.upsertDocument(norm.document);
      await repo.upsertChunks(norm.document, chunks);
    }
  }

  let status: IngestionPipelineResult["status"] = "ok";
  if (errors.length > 0) status = "partial";

  return {
    dryRun,
    status,
    documentsSeen: input.documents.length,
    documentsNormalised,
    chunksCreated,
    citationsExtracted,
    errors,
  };
}

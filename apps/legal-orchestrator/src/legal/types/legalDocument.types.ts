// Legal document + chunk + case types. Rows in `legal_documents`,
// `legal_chunks`, and `legal_cases`.

import type { SourceType } from "./legalSource.types";

export type LegalArea = "employment";

export interface LegalDocument {
  id: string;
  sourceId: string;
  title: string;
  documentType: string;
  officialReference?: string;
  sourceUrl: string;
  versionHash: string;
  publishedAt?: string;
  updatedAt?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  jurisdiction: string;
  legalArea: LegalArea;
  status: "active" | "superseded" | "withdrawn";
  rawText: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface LegalChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  heading?: string;
  sectionReference?: string;
  text: string;
  tokenCount?: number;
  authorityScore: number;
  recencyScore: number;
  citationWeight: number;
  metadata: Record<string, unknown>;
  /** sourceType is denormalised onto the chunk for retrieval display. */
  sourceType?: SourceType;
  createdAt: string;
}

export interface LegalCase {
  id: string;
  documentId?: string;
  neutralCitation?: string;
  court?: string;
  judgmentDate?: string;
  parties?: string;
  judges?: string;
  legalIssues?: string[];
  outcomeSummary?: string;
  precedentLevel?: number;
  citedStatutes?: string[];
  citedCases?: string[];
  createdAt: string;
}

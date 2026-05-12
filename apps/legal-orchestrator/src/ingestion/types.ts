/** Canonical ingestion source families (maps to DB source_type / legal_domain later). */
export type IngestionSourceKey =
  | "legislation"
  | "gov_uk_employment"
  | "acas"
  | "et_public"
  | "cac";

export interface RegistryEntry {
  /** Stable id for this registry row (not DB id). */
  readonly id: string;
  readonly sourceKey: IngestionSourceKey;
  /** Human title for logs / audit. */
  readonly title: string;
  /** Canonical HTTPS URL for HTTP retrieval (no redirects required in skeleton). */
  readonly canonicalUrl: string;
  /** Host for robots.txt lookup, e.g. www.legislation.gov.uk */
  readonly robotsHost: string;
  /** Path portion used with robots Disallow rules, e.g. /ukpga/1996/18/contents */
  readonly robotsPath: string;
}

export interface FetchAttemptResult {
  ok: boolean;
  status: number;
  url: string;
  body: string;
  error?: string;
  attempts: number;
}

export interface NormalizedDocument {
  title: string;
  canonicalUrl: string;
  text: string;
}

export interface TextChunk {
  chunkIndex: number;
  text: string;
}

export interface IngestionPlanItem {
  entry: RegistryEntry;
  /** Populated only after a live fetch + normalize (not in dry-run). */
  normalized?: NormalizedDocument;
  versionHash?: string;
  chunks?: TextChunk[];
  fetch?: FetchAttemptResult;
}

export interface IngestionPlanResult {
  readonly dryRun: boolean;
  readonly live: boolean;
  readonly writeChunks: boolean;
  readonly auditEnabled: boolean;
  readonly items: IngestionPlanItem[];
}

// --- Sprint 11: trusted-source + legal document shapes ---

export type TrustedSourceType =
  | "legislation"
  | "gov_guidance"
  | "acas_guidance"
  | "tribunal_case"
  | "hmcts"
  | "internal_template";

export type TrustedTrustLevel =
  | "primary_statute"
  | "primary_law"
  | "official_guidance"
  | "tribunal_authority"
  | "secondary_guidance";

export interface TrustedSource {
  id: string;
  name: string;
  sourceType: TrustedSourceType;
  baseUrl: string;
  jurisdiction: string;
  trustLevel: TrustedTrustLevel;
  enabled: boolean;
}

export interface RawLegalDocument {
  sourceId: string;
  title: string;
  canonicalUrl: string;
  documentType: string;
  jurisdiction: string;
  rawText?: string;
  rawHtml?: string;
}

export interface NormalisedLegalDocument {
  sourceId: string;
  title: string;
  canonicalUrl: string;
  documentType: string;
  jurisdiction: string;
  contentHash: string;
  cleanText: string;
  metadata: Record<string, unknown>;
}

export type NormaliseDocumentResult =
  | { ok: true; document: NormalisedLegalDocument }
  | { ok: false; code: string };

export interface LegalDocumentChunk {
  chunkIndex: number;
  headingPath: string[];
  chunkText: string;
  tokenCount: number;
  sectionReference?: string;
  metadata: Record<string, unknown>;
}

export interface ExtractedCitation {
  citationText: string;
  citationType: string;
  statuteTitle?: string;
  sectionReference?: string;
  neutralCitation?: string;
  metadata?: Record<string, unknown>;
}

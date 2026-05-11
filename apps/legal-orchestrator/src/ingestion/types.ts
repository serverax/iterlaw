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
  /** Canonical HTTPS URL for fetch (no redirects required in skeleton). */
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

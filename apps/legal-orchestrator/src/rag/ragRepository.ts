// ragRepository — typed, parameterized-SQL repository for the legal RAG
// schema (public.legal_sources / legal_documents / legal_chunks /
// legal_citations from migrations 001 + 005).
//
// Hard rules enforced by this module:
//   * No SQL is built by string concatenation from caller-provided input.
//     Every user-influenceable value enters the database as a bound
//     parameter ($1, $2, ...).
//   * No DELETE statements. Marking a document as superseded toggles
//     `is_active = false` on legal_documents.
//   * No external network calls. No filesystem writes.
//   * No secrets. The DSN is the responsibility of the DbClient injector.
//
// The repository is `DbClient`-shaped, not `pg.Pool`-shaped, so unit
// tests can pass a recording mock without bundling the `pg` driver.

import {
  ALLOWED_SOURCE_TYPES,
  type SourceTypeWide,
} from "./ragRepository.types";

// ---------------------------------------------------------------------
// DbClient — minimal surface every implementation must provide. Wire a
// real PostgresClient by wrapping `pg.Pool#query`.
// ---------------------------------------------------------------------

export interface DbQueryResult<TRow = unknown> {
  rows: TRow[];
  rowCount?: number;
}

export interface DbClient {
  query<TRow = unknown>(sql: string, params?: unknown[]): Promise<DbQueryResult<TRow>>;
}

// ---------------------------------------------------------------------
// Inputs.
// ---------------------------------------------------------------------

export interface UpsertLegalSourceInput {
  domain_id: string;
  source_type: SourceTypeWide;
  publisher?: string;
  title: string;
  citation_label?: string;
  jurisdiction: string;
  source_url?: string;
  canonical_url: string;
  effective_date?: string;
  authority_level?: number;
  content_hash?: string;
}

export interface UpsertLegalDocumentInput {
  source_id: string;
  domain_id: string;
  title: string;
  canonical_url?: string;
  official_reference?: string;
  version_date?: string;
  effective_date?: string;
  content_hash?: string;
  raw_text?: string;
  clean_text?: string;
}

export interface InsertLegalChunkInput {
  document_id: string;
  domain_id: string;
  jurisdiction: string;
  source_type: SourceTypeWide;
  title: string;
  url?: string;
  citation_label?: string;
  section_reference?: string;
  paragraph_reference?: string;
  chunk_index: number;
  chunk_text: string;
  token_count?: number;
  content_hash?: string;
  authority_level?: number;
  version_date?: string;
  effective_date?: string;
  applicable_to?: string;
  quality_score?: number;
}

export interface InsertLegalCitationInput {
  chunk_id: string;
  citation_label: string;
  context_snippet?: string;
}

export interface QueryChunksFilters {
  domain_code?: string;
  source_type?: SourceTypeWide;
  jurisdiction?: string;
  topic_query?: string;
  applicable_on?: string;
  min_authority_level?: number;
  min_quality_score?: number;
  limit?: number;
}

export interface RetrievedChunkRow {
  chunk_id: string;
  document_id: string;
  source_type: string;
  chunk_index: number;
  chunk_text: string;
  title: string;
  url: string | null;
  citation_label: string | null;
  section_reference: string | null;
  paragraph_reference: string | null;
  authority_level: number;
  effective_date: string | null;
  applicable_to: string | null;
  quality_score: number | null;
}

// ---------------------------------------------------------------------
// Validators. Throw `RagRepositoryValidationError` on bad input so the
// caller (CLI, HTTP layer, test) sees a structured failure rather than
// a Postgres error that might leak SQL.
// ---------------------------------------------------------------------

export class RagRepositoryValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "RagRepositoryValidationError";
  }
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertUuid(label: string, value: unknown): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new RagRepositoryValidationError("invalid_uuid", `${label} must be a UUID`);
  }
  return value;
}

function assertNonEmptyString(label: string, value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RagRepositoryValidationError(
      "invalid_string",
      `${label} must be a non-empty string`
    );
  }
  return value;
}

function assertSourceType(value: unknown): SourceTypeWide {
  if (typeof value !== "string" || !ALLOWED_SOURCE_TYPES.has(value)) {
    throw new RagRepositoryValidationError(
      "invalid_source_type",
      `source_type must be one of: ${Array.from(ALLOWED_SOURCE_TYPES).join(", ")}`
    );
  }
  return value as SourceTypeWide;
}

function assertOptionalIsoDate(label: string, value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) {
    throw new RagRepositoryValidationError(
      "invalid_iso_date",
      `${label} must be ISO YYYY-MM-DD`
    );
  }
  return value;
}

function assertOptionalAuthorityLevel(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new RagRepositoryValidationError(
      "invalid_authority_level",
      "authority_level must be a number in [0, 100]"
    );
  }
  return value;
}

function assertOptionalQualityScore(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RagRepositoryValidationError(
      "invalid_quality_score",
      "quality_score must be a number in [0, 1]"
    );
  }
  return value;
}

function assertNonNegativeInteger(label: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new RagRepositoryValidationError(
      "invalid_integer",
      `${label} must be a non-negative integer`
    );
  }
  return value;
}

// ---------------------------------------------------------------------
// Repository — every public function is a thin SQL-with-params wrapper.
// ---------------------------------------------------------------------

const DEFAULT_AUTHORITY_BY_SOURCE_TYPE: Record<string, number> = {
  legislation: 100,
  statutory_instrument: 90,
  appeal_case: 85,
  case_law: 80,
  tribunal_case: 70,
  acas_guidance: 60,
  gov_guidance: 50,
  template: 30,
  internal_note: 30,
};

export async function upsertLegalSource(
  client: DbClient,
  input: UpsertLegalSourceInput
): Promise<{ id: string }> {
  const params: unknown[] = [
    assertUuid("domain_id", input.domain_id),
    assertSourceType(input.source_type),
    input.publisher ?? null,
    assertNonEmptyString("title", input.title),
    input.citation_label ?? null,
    assertNonEmptyString("jurisdiction", input.jurisdiction),
    input.source_url ?? null,
    assertNonEmptyString("canonical_url", input.canonical_url),
    assertOptionalIsoDate("effective_date", input.effective_date),
    assertOptionalAuthorityLevel(
      input.authority_level ?? DEFAULT_AUTHORITY_BY_SOURCE_TYPE[input.source_type] ?? 50
    ),
    input.content_hash ?? null,
  ];

  const sql = `
    INSERT INTO legal_sources (
      domain_id, source_type, publisher, title, citation_label,
      jurisdiction, source_url, canonical_url, effective_date,
      authority_level, content_hash
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (domain_id, source_type, canonical_url) DO UPDATE SET
      publisher       = EXCLUDED.publisher,
      title           = EXCLUDED.title,
      citation_label  = EXCLUDED.citation_label,
      jurisdiction    = EXCLUDED.jurisdiction,
      source_url      = EXCLUDED.source_url,
      effective_date  = EXCLUDED.effective_date,
      authority_level = EXCLUDED.authority_level,
      content_hash    = EXCLUDED.content_hash,
      is_active       = true,
      updated_at      = now()
    RETURNING id
  `;

  const res = await client.query<{ id: string }>(sql, params);
  const row = res.rows[0];
  if (!row || typeof row.id !== "string") {
    throw new RagRepositoryValidationError(
      "no_returning_id",
      "upsertLegalSource: expected RETURNING id"
    );
  }
  return { id: row.id };
}

export async function upsertLegalDocument(
  client: DbClient,
  input: UpsertLegalDocumentInput
): Promise<{ id: string }> {
  const params: unknown[] = [
    assertUuid("source_id", input.source_id),
    assertUuid("domain_id", input.domain_id),
    assertNonEmptyString("title", input.title),
    input.canonical_url ?? null,
    input.official_reference ?? null,
    assertOptionalIsoDate("version_date", input.version_date),
    assertOptionalIsoDate("effective_date", input.effective_date),
    input.content_hash ?? null,
    input.raw_text ?? null,
    input.clean_text ?? null,
  ];

  // The unique key is (source_id, official_reference, version_date).
  // Postgres treats NULL as distinct in UNIQUE, so callers that omit
  // both official_reference and version_date are responsible for their
  // own dedup discipline; this is documented behaviour, not a bug.
  const sql = `
    INSERT INTO legal_documents (
      source_id, domain_id, title, canonical_url, official_reference,
      version_date, effective_date, content_hash, raw_text, clean_text
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (source_id, official_reference, version_date) DO UPDATE SET
      domain_id      = EXCLUDED.domain_id,
      title          = EXCLUDED.title,
      canonical_url  = EXCLUDED.canonical_url,
      effective_date = EXCLUDED.effective_date,
      content_hash   = EXCLUDED.content_hash,
      raw_text       = EXCLUDED.raw_text,
      clean_text     = EXCLUDED.clean_text,
      is_active      = true,
      updated_at     = now()
    RETURNING id
  `;

  const res = await client.query<{ id: string }>(sql, params);
  const row = res.rows[0];
  if (!row || typeof row.id !== "string") {
    throw new RagRepositoryValidationError(
      "no_returning_id",
      "upsertLegalDocument: expected RETURNING id"
    );
  }
  return { id: row.id };
}

export async function insertLegalChunks(
  client: DbClient,
  chunks: InsertLegalChunkInput[]
): Promise<{ inserted: number }> {
  if (chunks.length === 0) return { inserted: 0 };

  let inserted = 0;
  for (const c of chunks) {
    const params: unknown[] = [
      assertUuid("document_id", c.document_id),
      assertUuid("domain_id", c.domain_id),
      assertNonEmptyString("jurisdiction", c.jurisdiction),
      assertSourceType(c.source_type),
      assertNonEmptyString("title", c.title),
      c.url ?? null,
      c.citation_label ?? null,
      c.section_reference ?? null,
      c.paragraph_reference ?? null,
      assertNonNegativeInteger("chunk_index", c.chunk_index),
      assertNonEmptyString("chunk_text", c.chunk_text),
      c.token_count ?? null,
      c.content_hash ?? null,
      assertOptionalAuthorityLevel(c.authority_level ?? null),
      assertOptionalIsoDate("version_date", c.version_date),
      assertOptionalIsoDate("effective_date", c.effective_date),
      assertOptionalIsoDate("applicable_to", c.applicable_to),
      assertOptionalQualityScore(c.quality_score),
    ];

    const sql = `
      INSERT INTO legal_chunks (
        document_id, domain_id, jurisdiction, source_type, title, url,
        citation_label, section_reference, paragraph_reference,
        chunk_index, chunk_text, token_count, content_hash,
        authority_level, version_date, effective_date, applicable_to,
        quality_score
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        COALESCE($14, 50), $15, $16, $17, $18
      )
      ON CONFLICT (document_id, chunk_index) DO UPDATE SET
        domain_id           = EXCLUDED.domain_id,
        jurisdiction        = EXCLUDED.jurisdiction,
        source_type         = EXCLUDED.source_type,
        title               = EXCLUDED.title,
        url                 = EXCLUDED.url,
        citation_label      = EXCLUDED.citation_label,
        section_reference   = EXCLUDED.section_reference,
        paragraph_reference = EXCLUDED.paragraph_reference,
        chunk_text          = EXCLUDED.chunk_text,
        token_count         = EXCLUDED.token_count,
        content_hash        = EXCLUDED.content_hash,
        authority_level     = EXCLUDED.authority_level,
        version_date        = EXCLUDED.version_date,
        effective_date      = EXCLUDED.effective_date,
        applicable_to       = EXCLUDED.applicable_to,
        quality_score       = EXCLUDED.quality_score,
        is_active           = true,
        updated_at          = now()
    `;
    const res = await client.query(sql, params);
    inserted += res.rowCount ?? 0;
  }
  return { inserted };
}

export async function insertLegalCitations(
  client: DbClient,
  citations: InsertLegalCitationInput[]
): Promise<{ inserted: number }> {
  if (citations.length === 0) return { inserted: 0 };

  let inserted = 0;
  for (const c of citations) {
    const params: unknown[] = [
      assertUuid("chunk_id", c.chunk_id),
      assertNonEmptyString("citation_label", c.citation_label),
      c.context_snippet ?? null,
    ];
    const sql = `
      INSERT INTO legal_citations (chunk_id, citation_label, context_snippet)
      VALUES ($1, $2, $3)
    `;
    const res = await client.query(sql, params);
    inserted += res.rowCount ?? 0;
  }
  return { inserted };
}

export async function markDocumentSuperseded(
  client: DbClient,
  documentId: string
): Promise<{ updated: number }> {
  const id = assertUuid("documentId", documentId);
  // Soft supersede only. The schema does not carry a `superseded_by`
  // column on public.legal_documents; we mark inactive so retrieval
  // (`c.is_active = true` in postgresRetrieval) stops returning it.
  const sql = `
    UPDATE legal_documents
       SET is_active = false,
           updated_at = now()
     WHERE id = $1
  `;
  const res = await client.query(sql, [id]);
  return { updated: res.rowCount ?? 0 };
}

export async function queryChunks(
  client: DbClient,
  filters: QueryChunksFilters
): Promise<RetrievedChunkRow[]> {
  // Validate every value BEFORE building any SQL. Strings are validated
  // and then passed as bound parameters; never interpolated.
  const domainCode =
    filters.domain_code === undefined
      ? null
      : assertNonEmptyString("domain_code", filters.domain_code);
  const sourceType =
    filters.source_type === undefined ? null : assertSourceType(filters.source_type);
  const jurisdiction =
    filters.jurisdiction === undefined
      ? null
      : assertNonEmptyString("jurisdiction", filters.jurisdiction);
  const topicQuery =
    filters.topic_query === undefined
      ? null
      : assertNonEmptyString("topic_query", filters.topic_query);
  const applicableOn = assertOptionalIsoDate("applicable_on", filters.applicable_on);
  const minAuthority =
    filters.min_authority_level === undefined
      ? null
      : assertOptionalAuthorityLevel(filters.min_authority_level);
  const minQuality =
    filters.min_quality_score === undefined
      ? null
      : assertOptionalQualityScore(filters.min_quality_score);
  const cap = filters.limit ?? 20;
  if (typeof cap !== "number" || !Number.isFinite(cap) || cap <= 0 || cap > 200) {
    throw new RagRepositoryValidationError("invalid_limit", "limit must be in (0, 200]");
  }

  // Single SQL string with every value bound. No `if` branches that
  // append text from input — instead we rely on NULL short-circuits
  // (the same pattern Postgres FTS uses elsewhere in this repo).
  const sql = `
    SELECT
      c.id::text          AS chunk_id,
      c.document_id::text AS document_id,
      c.source_type       AS source_type,
      c.chunk_index       AS chunk_index,
      c.chunk_text        AS chunk_text,
      c.title             AS title,
      c.url               AS url,
      c.citation_label    AS citation_label,
      c.section_reference AS section_reference,
      c.paragraph_reference AS paragraph_reference,
      c.authority_level   AS authority_level,
      c.effective_date    AS effective_date,
      c.applicable_to     AS applicable_to,
      c.quality_score     AS quality_score
    FROM legal_chunks c
    JOIN legal_domains d ON d.id = c.domain_id
    WHERE c.is_active = true
      AND ($1::text IS NULL OR d.domain_code = $1)
      AND ($2::text IS NULL OR c.source_type = $2)
      AND ($3::text IS NULL OR c.jurisdiction = $3)
      AND ($4::text IS NULL OR c.search_vector @@ plainto_tsquery('english', $4))
      AND ($5::date IS NULL OR c.effective_date IS NULL OR c.effective_date <= $5::date)
      AND ($5::date IS NULL OR c.applicable_to  IS NULL OR c.applicable_to  >= $5::date)
      AND ($6::int  IS NULL OR c.authority_level >= $6::int)
      AND ($7::numeric IS NULL OR c.quality_score IS NULL OR c.quality_score >= $7::numeric)
    ORDER BY c.authority_level DESC, c.id ASC
    LIMIT $8::int
  `;

  const params: unknown[] = [
    domainCode,
    sourceType,
    jurisdiction,
    topicQuery,
    applicableOn,
    minAuthority,
    minQuality,
    cap,
  ];

  const res = await client.query<RetrievedChunkRow>(sql, params);
  return res.rows;
}

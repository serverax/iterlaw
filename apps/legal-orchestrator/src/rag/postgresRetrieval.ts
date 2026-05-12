// PostgresRetrieval — RetrievalPort backed by the legal_chunks /
// legal_documents / legal_sources schema in 001_legal_rag_foundation.sql.
//
// Mock-safe by design (same pattern as pgRagPort):
//   - If DATABASE_URL is missing, search() returns
//     `{ chunks: [], retrieval_notes: ["postgres_retrieval:db_url_missing"] }`
//     and never loads the `pg` driver.
//   - If `pg` is not installed in this environment, the lazy require
//     fails and we return an empty result with a clear note.
//   - All errors are sanitised: the connection string never appears
//     in thrown messages.
//
// Retrieval strategy:
//   1. Full-text search on legal_chunks.search_vector (GIN index).
//   2. ILIKE fallback if FTS returns zero rows.
// Vector retrieval is intentionally out of scope for this sprint;
// pgvector support is in the migration but the adapter does not call it.

import type { CorpusSourceType, RetrievalQuery } from "./rag.types";
import type { RetrievalPort, RetrievalPortResult, RetrievedLegalChunk } from "./retrieval.port";

export interface PostgresRetrievalConfig {
  databaseUrl?: string;
  /** Hard cap on results regardless of RetrievalQuery.limit. */
  maxResults?: number;
}

interface PgPool {
  query: (sql: string, values: unknown[]) => Promise<{ rows: unknown[] }>;
  end: () => Promise<void>;
}

const KNOWN_SOURCE_TYPES = new Set<string>([
  "legislation",
  "gov_guidance",
  "tribunal_case",
  "acas_guidance",
  "hmcts",
  "ehrc",
  "internal_template",
]);

function coerceSourceType(value: unknown): CorpusSourceType {
  if (typeof value === "string" && KNOWN_SOURCE_TYPES.has(value)) {
    return value as CorpusSourceType;
  }
  // Map adjacent variants used by the migration to the public enum.
  if (value === "appeal_case") return "tribunal_case";
  if (value === "case_law") return "tribunal_case";
  if (value === "statutory_instrument") return "legislation";
  if (value === "template") return "internal_template";
  return "internal_template";
}

function formatIsoDate(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return undefined;
}

export function mapRowToRetrievedLegalChunk(row: unknown): RetrievedLegalChunk {
  const r = (row ?? {}) as Record<string, unknown>;
  const str = (v: unknown, fb = ""): string =>
    typeof v === "string" ? v : v === null || v === undefined ? fb : String(v);
  const num = (v: unknown, fb: number): number => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return fb;
  };
  const optStr = (v: unknown): string | undefined =>
    typeof v === "string" && v.length > 0 ? v : undefined;
  return {
    chunk_id: str(r.chunk_id ?? r.id),
    document_id: str(r.document_id),
    source_type: coerceSourceType(r.source_type),
    chunk_index: num(r.chunk_index, 0),
    chunk_text: str(r.chunk_text),
    token_count_estimate: optStr(r.token_count) ? num(r.token_count, 0) : undefined,
    section_reference: optStr(r.section_reference),
    paragraph_reference: optStr(r.paragraph_reference),
    authority_level: num(r.authority_level, 50),
    title: optStr(r.title),
    url: optStr(r.url),
    citation_label: optStr(r.citation_label),
    effective_date: formatIsoDate(r.effective_date),
    applicable_to: formatIsoDate(r.applicable_to),
  };
}

export class PostgresRetrieval implements RetrievalPort {
  private readonly databaseUrl?: string;
  private readonly maxResults: number;

  constructor(config?: PostgresRetrievalConfig) {
    this.databaseUrl = config?.databaseUrl ?? process.env.DATABASE_URL;
    this.maxResults = config?.maxResults ?? 10;
  }

  /** True iff a real connection would be attempted on search(). */
  isLive(): boolean {
    return typeof this.databaseUrl === "string" && this.databaseUrl.length > 0;
  }

  async search(input: RetrievalQuery): Promise<RetrievalPortResult> {
    if (!this.isLive()) {
      return {
        chunks: [],
        retrieval_notes: ["postgres_retrieval:db_url_missing"],
      };
    }

    let PoolCtor: unknown;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      PoolCtor = (require("pg") as { Pool: unknown }).Pool;
    } catch {
      return {
        chunks: [],
        retrieval_notes: ["postgres_retrieval:pg_driver_unavailable"],
      };
    }
    const Ctor = PoolCtor as new (cfg: { connectionString: string }) => PgPool;
    const pool: PgPool = new Ctor({ connectionString: this.databaseUrl! });

    const cap = Math.min(Math.max(1, input.limit), this.maxResults);
    const sourceTypes = input.source_types && input.source_types.length > 0 ? input.source_types : null;
    const rawTemporalForSql = input.filters?.applicable_on ?? null;
    let p6: string | null = null;
    if (typeof rawTemporalForSql === "string") {
      const t = rawTemporalForSql.trim().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(t)) p6 = t;
    }
    const notes: string[] = [];

    try {
      const fts = await this.runFts(pool, input, cap, sourceTypes, p6);
      if (fts.length > 0) {
        notes.push(`postgres_retrieval:fts_hits=${fts.length}`);
        if (p6) notes.push(`postgres_retrieval:applicable_on=${p6}`);
        return { chunks: fts.map(mapRowToRetrievedLegalChunk), retrieval_notes: notes };
      }
      notes.push("postgres_retrieval:fts_empty");
      const ilike = await this.runIlike(pool, input, cap, sourceTypes, p6);
      notes.push(`postgres_retrieval:ilike_hits=${ilike.length}`);
      if (p6) notes.push(`postgres_retrieval:applicable_on=${p6}`);
      return { chunks: ilike.map(mapRowToRetrievedLegalChunk), retrieval_notes: notes };
    } catch (_err) {
      return {
        chunks: [],
        retrieval_notes: ["postgres_retrieval:query_failed"],
      };
    } finally {
      await pool.end().catch(() => undefined);
    }
  }

  private temporalWhereSql(): string {
    return `
        AND ($6::date IS NULL OR c.effective_date IS NULL OR c.effective_date <= $6::date)
        AND ($6::date IS NULL OR c.applicable_to IS NULL OR c.applicable_to >= $6::date)`;
  }

  private async runFts(
    pool: PgPool,
    input: RetrievalQuery,
    cap: number,
    sourceTypes: CorpusSourceType[] | null,
    applicableOn: string | null
  ): Promise<unknown[]> {
    const sql = `
      SELECT
        c.id::text          AS chunk_id,
        c.document_id::text AS document_id,
        c.source_type       AS source_type,
        c.chunk_index       AS chunk_index,
        c.chunk_text        AS chunk_text,
        c.token_count       AS token_count,
        c.section_reference AS section_reference,
        c.paragraph_reference AS paragraph_reference,
        c.authority_level   AS authority_level,
        c.title             AS title,
        c.url               AS url,
        c.citation_label    AS citation_label,
        c.effective_date    AS effective_date,
        c.applicable_to     AS applicable_to
      FROM legal_chunks c
      JOIN legal_domains d ON d.id = c.domain_id
      WHERE d.domain_code = $1
        AND c.is_active = true
        AND c.jurisdiction = $2
        AND c.search_vector @@ plainto_tsquery('english', $3)
        AND ($4::text[] IS NULL OR c.source_type = ANY($4::text[]))
        ${this.temporalWhereSql()}
      ORDER BY
        ts_rank(c.search_vector, plainto_tsquery('english', $3)) DESC,
        c.authority_level DESC
      LIMIT $5
    `;
    const params: unknown[] = [
      input.legal_pack,
      input.jurisdiction ?? "England and Wales",
      input.query_text,
      sourceTypes,
      cap,
      applicableOn,
    ];
    const res = await pool.query(sql, params);
    return res.rows;
  }

  private async runIlike(
    pool: PgPool,
    input: RetrievalQuery,
    cap: number,
    sourceTypes: CorpusSourceType[] | null,
    applicableOn: string | null
  ): Promise<unknown[]> {
    const sql = `
      SELECT
        c.id::text          AS chunk_id,
        c.document_id::text AS document_id,
        c.source_type       AS source_type,
        c.chunk_index       AS chunk_index,
        c.chunk_text        AS chunk_text,
        c.token_count       AS token_count,
        c.section_reference AS section_reference,
        c.paragraph_reference AS paragraph_reference,
        c.authority_level   AS authority_level,
        c.title             AS title,
        c.url               AS url,
        c.citation_label    AS citation_label,
        c.effective_date    AS effective_date,
        c.applicable_to     AS applicable_to
      FROM legal_chunks c
      JOIN legal_domains d ON d.id = c.domain_id
      WHERE d.domain_code = $1
        AND c.is_active = true
        AND c.jurisdiction = $2
        AND c.chunk_text ILIKE '%' || $3 || '%'
        AND ($4::text[] IS NULL OR c.source_type = ANY($4::text[]))
        ${this.temporalWhereSql()}
      ORDER BY c.authority_level DESC
      LIMIT $5
    `;
    const params: unknown[] = [
      input.legal_pack,
      input.jurisdiction ?? "England and Wales",
      input.query_text,
      sourceTypes,
      cap,
      applicableOn,
    ];
    const res = await pool.query(sql, params);
    return res.rows;
  }
}

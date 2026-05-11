// pgRagPort — PostgreSQL-backed RAG search port.
//
// Mock-safe by design:
//   - If DATABASE_URL is not set, `search` returns [] without ever calling
//     the network. No `pg` import happens.
//   - If `pg` is not installed (peer-optional), `search` returns [] without
//     throwing. Useful in CI / unit-test environments.
//   - All errors are sanitised: DATABASE_URL never appears in thrown messages.
//
// The pg dependency is loaded lazily via `require('pg')` so that the
// skeleton's typecheck + build do not require `pg` to be present.

import type { RagChunk } from "../types/legal";

export interface PgRagPortConfig {
  /** PostgreSQL connection string. If undefined, the port is in mock mode. */
  databaseUrl?: string;
  /** Hard cap on results regardless of caller request. Defaults to 10. */
  maxResults?: number;
}

export interface PgRagSearchInput {
  legal_pack: string;
  query: string;
  topic: string;
  jurisdiction: string;
  limit: number;
}

export class PgRagPort {
  private readonly databaseUrl?: string;
  private readonly maxResults: number;

  constructor(config?: PgRagPortConfig) {
    this.databaseUrl = config?.databaseUrl ?? process.env.DATABASE_URL;
    this.maxResults = config?.maxResults ?? 10;
  }

  /**
   * Returns true if a real database connection would be attempted.
   * Exposed so callers can decide between PgRagPort and a mock without
   * inspecting env vars themselves.
   */
  isLive(): boolean {
    return typeof this.databaseUrl === "string" && this.databaseUrl.length > 0;
  }

  async search(input: PgRagSearchInput): Promise<RagChunk[]> {
    // Mock-safe short circuit. No env -> no network.
    if (!this.isLive()) {
      return [];
    }

    // Lazy require so the skeleton doesn't require `pg` to be installed.
    let Pool: unknown;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Pool = (require("pg") as { Pool: unknown }).Pool;
    } catch {
      // 'pg' is not installed in this environment. Treat as mock.
      return [];
    }

    // Build a one-shot pool, query, close. Production callers should
    // replace this with an injected pool — see PgRagPort.fromPool below.
    type PgPool = {
      query: (sql: string, values: unknown[]) => Promise<{ rows: unknown[] }>;
      end: () => Promise<void>;
    };
    const PoolCtor = Pool as new (cfg: { connectionString: string }) => PgPool;
    const pool: PgPool = new PoolCtor({ connectionString: this.databaseUrl! });

    const cap = Math.min(Math.max(1, input.limit), this.maxResults);
    try {
      const rows = await this.runSearch(pool, input, cap);
      return rows.map(mapRowToChunk);
    } catch (err) {
      // Sanitise: do not leak the connection string, the SQL, or any
      // pg-driver stack content. Caller gets a generic identifier only.
      throw new Error("pg_rag_query_failed");
    } finally {
      await pool.end().catch(() => undefined);
    }
  }

  private async runSearch(
    pool: { query: (sql: string, values: unknown[]) => Promise<{ rows: unknown[] }> },
    input: PgRagSearchInput,
    cap: number
  ): Promise<unknown[]> {
    // 1) Full-text search.
    const ftsSql = `
      SELECT
        c.id::text         AS chunk_id,
        c.document_id::text AS document_id,
        c.source_type      AS source_type,
        c.authority_level  AS authority_level,
        c.title            AS title,
        c.url              AS url,
        c.section_reference AS section_reference,
        c.paragraph_reference AS paragraph_reference,
        c.chunk_text       AS chunk_text,
        ts_rank(c.search_vector, plainto_tsquery('english', $1)) AS score
      FROM legal_chunks c
      WHERE c.is_active = true
        AND c.jurisdiction = $2
        AND c.search_vector @@ plainto_tsquery('english', $1)
      ORDER BY score DESC, c.authority_level DESC
      LIMIT $3
    `;
    const ftsRes = await pool.query(ftsSql, [input.query, input.jurisdiction, cap]);
    if (ftsRes.rows.length > 0) return ftsRes.rows;

    // 2) ILIKE fallback (small corpora, single-word queries, FTS misses).
    const ilikeSql = `
      SELECT
        c.id::text         AS chunk_id,
        c.document_id::text AS document_id,
        c.source_type      AS source_type,
        c.authority_level  AS authority_level,
        c.title            AS title,
        c.url              AS url,
        c.section_reference AS section_reference,
        c.paragraph_reference AS paragraph_reference,
        c.chunk_text       AS chunk_text,
        0::real            AS score
      FROM legal_chunks c
      WHERE c.is_active = true
        AND c.jurisdiction = $2
        AND c.chunk_text ILIKE '%' || $1 || '%'
      ORDER BY c.authority_level DESC
      LIMIT $3
    `;
    const ilikeRes = await pool.query(ilikeSql, [input.query, input.jurisdiction, cap]);
    return ilikeRes.rows;
  }
}

/**
 * Pure row-mapper. Exposed for unit testing without needing a live pg.
 * Defensive about nulls / unexpected shapes — we never throw from here.
 */
export function mapRowToChunk(row: unknown): RagChunk {
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
    chunk_id: str(r.chunk_id),
    document_id: str(r.document_id),
    source_type: str(r.source_type, "internal_note"),
    authority_level: num(r.authority_level, 50),
    title: str(r.title),
    url: str(r.url),
    section_reference: optStr(r.section_reference),
    paragraph_reference: optStr(r.paragraph_reference),
    chunk_text: str(r.chunk_text),
    score: num(r.score, 0),
  };
}

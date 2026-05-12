// ragRunRepository — typed wrapper around the `rag_runs` table.
//
// Hard rules per the Master Order:
//   * Parameterized SQL only. No raw user input is interpolated.
//   * No destructive DELETE.
//   * No production DB connection from this file. The repository accepts
//     an injected `DbClient` (same shape as src/rag/ragRepository.ts).
//   * If no DbClient is supplied, every function returns
//     `{ status: "DB_NOT_WIRED", reason: "..." }` — never a fake success.

import type { AnswerStatus, RagRunRecord, RetrievalMode } from "../types/legalRag.types";

export interface DbQueryResult<TRow = unknown> {
  rows: TRow[];
  rowCount?: number;
}

export interface DbClient {
  query<TRow = unknown>(sql: string, params?: unknown[]): Promise<DbQueryResult<TRow>>;
}

export type RepositoryResult<TOk> =
  | ({ status: "ok" } & TOk)
  | { status: "DB_NOT_WIRED"; reason: string }
  | { status: "validation_error"; code: string; message: string };

export interface CreateRagRunInput {
  userQuestion: string;
  normalizedQuestion?: string;
  jurisdiction?: string;
  legalArea?: string;
  issueType?: string[];
  retrievalMode?: RetrievalMode;
}

export interface UpdateRagRunStatusInput {
  id: string;
  answerStatus: AnswerStatus;
  confidenceScore?: number;
  riskFlags?: string[];
  sourcesUsed?: RagRunRecord["sourcesUsed"];
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const ALLOWED_STATUSES = new Set<AnswerStatus>([
  "answered",
  "needs_more_facts",
  "high_risk",
  "insufficient_sources",
  "verification_failed",
]);

function assertNonEmpty(label: string, value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return `${label} must be a non-empty string`;
  }
  return null;
}

export async function createRagRun(
  client: DbClient | null | undefined,
  input: CreateRagRunInput
): Promise<RepositoryResult<{ id: string }>> {
  const err = assertNonEmpty("userQuestion", input.userQuestion);
  if (err) return { status: "validation_error", code: "invalid_user_question", message: err };

  if (!client) {
    return {
      status: "DB_NOT_WIRED",
      reason: "createRagRun: no DbClient supplied; rag_run not persisted",
    };
  }

  const params: unknown[] = [
    input.userQuestion,
    input.normalizedQuestion ?? null,
    input.jurisdiction ?? "england_wales",
    input.legalArea ?? null,
    input.issueType ?? null,
    input.retrievalMode ?? "none",
  ];
  const sql = `
    INSERT INTO rag_runs (
      user_question, normalized_question, jurisdiction, legal_area,
      issue_type, retrieval_mode
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `;
  const res = await client.query<{ id: string }>(sql, params);
  const row = res.rows[0];
  if (!row || typeof row.id !== "string") {
    return {
      status: "validation_error",
      code: "no_returning_id",
      message: "createRagRun: expected RETURNING id",
    };
  }
  return { status: "ok", id: row.id };
}

export async function updateRagRunStatus(
  client: DbClient | null | undefined,
  input: UpdateRagRunStatusInput
): Promise<RepositoryResult<{ updated: number }>> {
  if (!UUID_RE.test(input.id)) {
    return { status: "validation_error", code: "invalid_uuid", message: "id must be a UUID" };
  }
  if (!ALLOWED_STATUSES.has(input.answerStatus)) {
    return {
      status: "validation_error",
      code: "invalid_answer_status",
      message: `answerStatus must be one of: ${Array.from(ALLOWED_STATUSES).join(", ")}`,
    };
  }

  if (!client) {
    return {
      status: "DB_NOT_WIRED",
      reason: "updateRagRunStatus: no DbClient supplied; rag_run not updated",
    };
  }

  const params: unknown[] = [
    input.id,
    input.answerStatus,
    typeof input.confidenceScore === "number" ? input.confidenceScore : null,
    input.riskFlags ?? null,
    input.sourcesUsed ? JSON.stringify(input.sourcesUsed) : null,
  ];
  const sql = `
    UPDATE rag_runs
       SET answer_status    = $2,
           confidence_score = COALESCE($3, confidence_score),
           risk_flags       = COALESCE($4, risk_flags),
           sources_used     = COALESCE($5::jsonb, sources_used)
     WHERE id = $1
  `;
  const res = await client.query(sql, params);
  return { status: "ok", updated: res.rowCount ?? 0 };
}

export async function getRagRunById(
  client: DbClient | null | undefined,
  id: string
): Promise<RepositoryResult<{ run: RagRunRecord | null }>> {
  if (!UUID_RE.test(id)) {
    return { status: "validation_error", code: "invalid_uuid", message: "id must be a UUID" };
  }
  if (!client) {
    return { status: "DB_NOT_WIRED", reason: "getRagRunById: no DbClient supplied" };
  }
  const sql = `
    SELECT id::text          AS id,
           user_question     AS "userQuestion",
           normalized_question AS "normalizedQuestion",
           jurisdiction      AS jurisdiction,
           legal_area        AS "legalArea",
           issue_type        AS "issueType",
           retrieval_mode    AS "retrievalMode",
           sources_used      AS "sourcesUsed",
           confidence_score  AS "confidenceScore",
           answer_status     AS "answerStatus",
           risk_flags        AS "riskFlags",
           created_at        AS "createdAt"
      FROM rag_runs
     WHERE id = $1
     LIMIT 1
  `;
  const res = await client.query<RagRunRecord>(sql, [id]);
  return { status: "ok", run: res.rows[0] ?? null };
}

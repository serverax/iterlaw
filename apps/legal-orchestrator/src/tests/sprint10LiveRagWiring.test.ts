// Sprint 10 — live RAG retrieval contract lock-in.
//
// The audit in docs/iterlaw/SPRINT_10_LIVE_RAG_PLAN.md confirmed that
// `apps/legal-orchestrator/src/rag/postgresRetrieval.ts` already
// targets the canonical 001-chain schema (`public.legal_chunks` +
// `public.legal_domains`) — NOT the UK-employment-specific
// `uk_emp_rag.*` tables. The retrieval path also returns the citation
// evidence the citation gate needs, and never imports an external LLM
// client.
//
// These tests lock those facts in so a future refactor cannot
// silently move retrieval to a different schema, drop a citation
// field, or introduce an LLM dependency.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAG_DIR = join(__dirname, "../rag");
const POSTGRES_RETRIEVAL = join(RAG_DIR, "postgresRetrieval.ts");

function readPostgresRetrieval(): string {
  return readFileSync(POSTGRES_RETRIEVAL, "utf8");
}

function walkTs(root: string, out: string[] = []): string[] {
  for (const name of readdirSync(root)) {
    if (name === "node_modules" || name === "dist") continue;
    const full = join(root, name);
    const s = statSync(full);
    if (s.isDirectory()) walkTs(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

describe("Sprint 10 — live retrieval targets the canonical schema", () => {
  it("postgresRetrieval reads from canonical public.legal_chunks", () => {
    const src = readPostgresRetrieval();
    expect(src).toMatch(/FROM\s+legal_chunks\s+c\b/);
  });

  it("postgresRetrieval joins public.legal_domains via domain_id", () => {
    const src = readPostgresRetrieval();
    expect(src).toMatch(/JOIN\s+legal_domains\s+d\s+ON\s+d\.id\s*=\s*c\.domain_id/);
  });

  it("postgresRetrieval does NOT reference the uk_emp_rag schema in SQL", () => {
    // The canonical 001-chain retrieval target is public.*. The
    // uk_emp_rag.* domain tables are written by ingestion but NOT read
    // by the live retrieval path. Mixing the two schemas in the same
    // SELECT is a contract breach per RAG_SCHEMA_CANONICAL_DECISION.md.
    const src = readPostgresRetrieval();
    expect(src).not.toMatch(/uk_emp_rag\./);
  });

  it("postgresRetrieval filters on is_active = true (active/superseded boundary)", () => {
    const src = readPostgresRetrieval();
    expect(src).toMatch(/c\.is_active\s*=\s*true/);
  });

  it("postgresRetrieval applies the legal_pack (domain_code) filter", () => {
    const src = readPostgresRetrieval();
    expect(src).toMatch(/d\.domain_code\s*=\s*\$1/);
  });

  it("postgresRetrieval applies the jurisdiction filter", () => {
    const src = readPostgresRetrieval();
    expect(src).toMatch(/c\.jurisdiction\s*=\s*\$2/);
  });

  it("postgresRetrieval applies the optional source_types ANY-filter", () => {
    const src = readPostgresRetrieval();
    expect(src).toMatch(/c\.source_type\s*=\s*ANY\(\$4::text\[\]\)/);
  });

  it("postgresRetrieval selects the full citation-evidence set", () => {
    const src = readPostgresRetrieval();
    for (const col of [
      "chunk_id",
      "document_id",
      "source_type",
      "title",
      "url",
      "citation_label",
      "section_reference",
      "paragraph_reference",
      "authority_level",
      "effective_date",
      "applicable_to",
    ]) {
      expect(src, `select column missing: ${col}`).toMatch(new RegExp(`AS\\s+${col}`));
    }
  });

  it("postgresRetrieval applies the temporal filter on both effective_date and applicable_to", () => {
    const src = readPostgresRetrieval();
    expect(src).toContain(
      "$6::date IS NULL OR c.effective_date IS NULL OR c.effective_date <= $6::date"
    );
    expect(src).toMatch(
      /\$6::date IS NULL\s+OR c\.applicable_to IS NULL\s+OR c\.applicable_to >= \$6::date/s
    );
  });
});

describe("Sprint 10 — live retrieval is mock-safe", () => {
  it("postgresRetrieval falls back to db_url_missing when DATABASE_URL is absent", () => {
    const src = readPostgresRetrieval();
    expect(src).toContain('"postgres_retrieval:db_url_missing"');
    expect(src).toContain('"postgres_retrieval:pg_driver_unavailable"');
    expect(src).toContain('"postgres_retrieval:query_failed"');
  });

  it("postgresRetrieval lazy-requires the pg driver (no top-level import)", () => {
    const src = readPostgresRetrieval();
    expect(src).not.toMatch(/^\s*import[^\n]+from\s+["']pg["']/m);
    expect(src).toMatch(/require\(["']pg["']\)/);
  });
});

describe("Sprint 10 — no external LLM coupling in the retrieval path", () => {
  const ragFiles = walkTs(RAG_DIR);

  it("rag/ has no openai / anthropic / ollama / node-fetch / undici / axios import", () => {
    const bannedImport = /from\s+['"](openai|@anthropic-ai\/sdk|ollama|node-fetch|undici|axios|@google\/generative-ai)['"]/;
    const offenders: string[] = [];
    for (const f of ragFiles) {
      const body = readFileSync(f, "utf8");
      if (bannedImport.test(body)) offenders.push(f);
    }
    expect(offenders, `LLM/HTTP imports in retrieval path: ${offenders.join(", ")}`).toEqual([]);
  });

  it("rag/ has no `fetch(` call (no HTTP from retrieval)", () => {
    const offenders: string[] = [];
    for (const f of ragFiles) {
      const body = readFileSync(f, "utf8");
      // Strip comments and string contents conservatively before scanning.
      const stripped = body
        .replace(/\/\/[^\n]*\n/g, "\n")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      if (/\bfetch\s*\(/.test(stripped)) offenders.push(f);
    }
    expect(offenders, `fetch( call in retrieval path: ${offenders.join(", ")}`).toEqual([]);
  });
});

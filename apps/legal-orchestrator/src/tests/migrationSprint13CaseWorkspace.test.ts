// Static safety tests for 105_case_workspace.sql.
//
// Locks the user-approved primary_issue + status taxonomies, the
// legal_case_timeline / legal_case_sources design, and additive-only
// contract.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIG = join(__dirname, "../../db/migrations/105_case_workspace.sql");
const DOWN = join(__dirname, "../../db/migrations/105_case_workspace.down.sql");
const SRC = readFileSync(MIG, "utf8");

function stripComments(s: string): string {
  return s
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
}

const ALL_CASE_TABLES = [
  "legal_case_records",
  "legal_case_facts",
  "legal_case_documents",
  "legal_case_drafts",
  "legal_case_timeline",
  "legal_case_sources",
];

describe("105 case workspace — six tables present", () => {
  for (const t of ALL_CASE_TABLES) {
    it(`creates public.${t} idempotently`, () => {
      expect(SRC).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${t}\\b`));
    });
  }
});

describe("105 case workspace — every table is workspace_id-scoped", () => {
  for (const t of ALL_CASE_TABLES) {
    it(`${t} carries workspace_id`, () => {
      // Match only the CREATE TABLE column block, not adjacent comments
      // or ALTER blocks that also mention the table name.
      const re = new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${t}\\s*\\(([\\s\\S]*?)\\);`);
      const m = SRC.match(re);
      expect(m, `${t}: CREATE TABLE block not found`).not.toBeNull();
      const createBlock = m![1];
      expect(createBlock, `${t} block must include workspace_id column`).toMatch(/\bworkspace_id\b/);
    });
  }
});

describe("105 legal_case_records — primary_issue + status taxonomy", () => {
  const PRIMARY_ISSUES = [
    "unfair_dismissal",
    "constructive_dismissal",
    "discrimination",
    "redundancy",
    "wages_pay",
    "holiday_pay",
    "working_time",
    "sickness_absence",
    "grievance",
    "disciplinary",
    "whistleblowing",
    "maternity_parental",
    "contract_terms",
    "settlement_agreement",
    "acas_early_conciliation",
    "employment_tribunal",
    "other",
  ];

  const STATUSES = [
    "draft",
    "intake",
    "needs_more_facts",
    "evidence_collection",
    "legal_research",
    "advice_ready",
    "document_drafting",
    "submitted",
    "waiting_response",
    "acas",
    "tribunal_preparation",
    "tribunal_submitted",
    "settled",
    "closed",
    "archived",
  ];

  it("CHECK constraint lists all 17 primary_issue values", () => {
    for (const v of PRIMARY_ISSUES) {
      expect(SRC, `primary_issue missing: ${v}`).toMatch(new RegExp(`'${v}'`));
    }
  });

  it("CHECK constraint lists all 15 status values", () => {
    for (const v of STATUSES) {
      expect(SRC, `status missing: ${v}`).toMatch(new RegExp(`'${v}'`));
    }
  });

  it("primary_issue + status use TEXT + CHECK, not Postgres ENUM types", () => {
    expect(SRC).not.toMatch(/CREATE TYPE[^;]*AS ENUM/i);
    expect(SRC).toMatch(/primary_issue\s+TEXT\s+NOT NULL/);
    expect(SRC).toMatch(/status\s+TEXT\s+NOT NULL/);
  });
});

describe("105 legal_case_timeline — user-journey events", () => {
  const EVENT_TYPES = [
    "user_event",
    "document_uploaded",
    "document_extracted",
    "employer_communication",
    "employee_communication",
    "acas_event",
    "grievance_event",
    "disciplinary_event",
    "appeal_event",
    "settlement_event",
    "tribunal_event",
    "deadline_reminder",
    "system_checkpoint",
    "system_reminder",
    "other",
  ];

  it("carries all 15 event_type values", () => {
    for (const v of EVENT_TYPES) {
      expect(SRC, `event_type missing: ${v}`).toMatch(new RegExp(`'${v}'`));
    }
  });

  it("has FK to legal_case_records ON DELETE CASCADE", () => {
    expect(SRC).toMatch(/legal_case_timeline_case_id_fkey/);
    expect(SRC).toMatch(/REFERENCES public\.legal_case_records\(id\) ON DELETE CASCADE/);
  });
});

describe("105 legal_case_sources — JOIN table to corpus", () => {
  it("references four corpus tables: legal_sources, legal_documents, legal_chunks, legal_cases", () => {
    expect(SRC).toMatch(/legal_source_id\s+UUID/);
    expect(SRC).toMatch(/legal_document_id\s+UUID/);
    expect(SRC).toMatch(/legal_chunk_id\s+UUID/);
    expect(SRC).toMatch(/legal_case_id\s+UUID/);
  });

  it("each corpus FK uses ON DELETE SET NULL (citation history survives corpus deletes)", () => {
    expect(SRC).toMatch(/legal_case_sources_legal_source_id_fkey[^$]*SET NULL/);
    expect(SRC).toMatch(/legal_case_sources_legal_document_id_fkey[^$]*SET NULL/);
    expect(SRC).toMatch(/legal_case_sources_legal_chunk_id_fkey[^$]*SET NULL/);
    expect(SRC).toMatch(/legal_case_sources_legal_case_id_fkey[^$]*SET NULL/);
  });

  it("has a CHECK enforcing at least one reference column is set", () => {
    expect(SRC).toMatch(/legal_case_sources_has_reference/);
  });

  it("preserves citation_url, citation_label, retrieval_reason, relevance_score, effective_from/to", () => {
    for (const col of ["citation_url", "citation_label", "retrieval_reason", "relevance_score", "effective_from", "effective_to"]) {
      expect(SRC).toMatch(new RegExp(`\\b${col}\\b`));
    }
  });
});

describe("105 case workspace — every child has FK to parent + workspace ON DELETE CASCADE", () => {
  const CHILDREN = ["legal_case_facts", "legal_case_documents", "legal_case_drafts", "legal_case_timeline", "legal_case_sources"];
  for (const child of CHILDREN) {
    it(`${child} cascades from legal_case_records and workspaces`, () => {
      expect(SRC).toMatch(new RegExp(`${child}_case_id_fkey[\\s\\S]*?REFERENCES public\\.legal_case_records\\(id\\) ON DELETE CASCADE`));
      expect(SRC).toMatch(new RegExp(`${child}_workspace_id_fkey[\\s\\S]*?REFERENCES public\\.workspaces\\(id\\) ON DELETE CASCADE`));
    });
  }
});

describe("105 case workspace — additive only", () => {
  it("uses CREATE TABLE IF NOT EXISTS everywhere", () => {
    const stripped = stripComments(SRC);
    const creates = [...stripped.matchAll(/CREATE TABLE\b[^;]*/g)];
    for (const m of creates) {
      expect(m[0]).toMatch(/IF NOT EXISTS/);
    }
  });

  it("contains no destructive SQL outside comments", () => {
    const stripped = stripComments(SRC);
    expect(stripped).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX|SCHEMA|EXTENSION)\b/i);
    expect(stripped).not.toMatch(/\bTRUNCATE\b/i);
    expect(stripped).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(stripped).not.toMatch(/ALTER\s+TABLE[^\n]*\bDROP\b/i);
    expect(stripped).not.toMatch(/ALTER\s+TABLE[^\n]*\bRENAME\b/i);
  });

  it("does not embed secrets / HTTP / fetch", () => {
    expect(SRC).not.toMatch(/DATABASE_URL\s*=/i);
    expect(SRC).not.toMatch(/\bfetch\s*\(/i);
    expect(SRC).not.toMatch(/\bcurl\b/i);
    expect(SRC).not.toMatch(/\bwget\b/i);
    expect(SRC).not.toMatch(/postgres(ql)?:\/\/[^\s]+:[^\s]+@/i);
  });

  it("has a matching down migration that drops in reverse-FK order", () => {
    const downBody = readFileSync(DOWN, "utf8");
    const expectedOrder = [
      "legal_case_sources",
      "legal_case_timeline",
      "legal_case_drafts",
      "legal_case_documents",
      "legal_case_facts",
      "legal_case_records",
    ];
    let prev = -1;
    for (const t of expectedOrder) {
      const idx = downBody.indexOf(t);
      expect(idx, `down missing ${t}`).toBeGreaterThan(prev);
      prev = idx;
    }
  });
});

describe("105 case workspace — naming disambiguation", () => {
  it("clearly separates legal_case_records (USER) from the corpus legal_cases via comment", () => {
    expect(SRC).toMatch(/USER case \(not the corpus legal_cases\)|USER case|legal_cases.*CORPUS/i);
  });
});

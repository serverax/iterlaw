// Static safety tests for 106_enable_rls.sql.
//
// Locks the user-data RLS contract:
//   * RLS enabled only on user-data tables (not corpus)
//   * Helper functions fail closed when GUCs are unset
//   * Admin / solicitor / member roles enforce the approved matrix

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIG = join(__dirname, "../../db/migrations/106_enable_rls.sql");
const DOWN = join(__dirname, "../../db/migrations/106_enable_rls.down.sql");
const SRC = readFileSync(MIG, "utf8");

function stripComments(s: string): string {
  return s
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
}

const USER_DATA_TABLES = [
  "users",
  "workspaces",
  "workspace_members",
  "legal_case_records",
  "legal_case_facts",
  "legal_case_documents",
  "legal_case_drafts",
  "legal_case_timeline",
  "legal_case_sources",
];

const CORPUS_TABLES_MUST_NOT_BE_TOUCHED = [
  "legal_sources",
  "legal_documents",
  "legal_chunks",
  "legal_cases",
  "legal_citations",
  "legal_case_law",
  "tribunal_decisions",
  "rag_runs",
  "rag_query_audit",
  "answer_audit_log",
  "verified_answers_cache",
  "source_update_log",
  "answer_verification_log",
];

describe("106 RLS — enabled on every user-data table", () => {
  for (const t of USER_DATA_TABLES) {
    it(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`, () => {
      expect(SRC).toMatch(new RegExp(`ALTER TABLE public\\.${t}\\s+ENABLE ROW LEVEL SECURITY`));
    });
  }
});

describe("106 RLS — corpus tables are NOT touched", () => {
  for (const t of CORPUS_TABLES_MUST_NOT_BE_TOUCHED) {
    it(`does NOT ALTER TABLE public.${t}`, () => {
      const stripped = stripComments(SRC);
      // Allow the table name to appear only inside the
      // CORPUS_TABLES_MUST_NOT_BE_TOUCHED comment block — strip
      // comments first.
      expect(stripped).not.toMatch(new RegExp(`ALTER TABLE public\\.${t}\\b`));
    });
  }
});

describe("106 RLS — helper functions fail closed", () => {
  it("current_app_user_id reads app.user_id and returns NULL on empty/invalid", () => {
    expect(SRC).toMatch(/CREATE OR REPLACE FUNCTION public\.current_app_user_id\(\)/);
    expect(SRC).toMatch(/current_setting\('app\.user_id', true\)/);
    expect(SRC).toMatch(/RETURN NULL/);
    expect(SRC).toMatch(/invalid_text_representation/);
  });

  it("current_app_user_role reads app.user_role and defaults to 'user'", () => {
    expect(SRC).toMatch(/CREATE OR REPLACE FUNCTION public\.current_app_user_role\(\)/);
    expect(SRC).toMatch(/current_setting\('app\.user_role', true\)/);
    expect(SRC).toMatch(/coalesce\(NULLIF\(current_setting\('app\.user_role', true\), ''\), 'user'\)/);
  });

  it("current_app_user_is_admin gates admin via the user_role GUC", () => {
    expect(SRC).toMatch(/CREATE OR REPLACE FUNCTION public\.current_app_user_is_admin\(\)/);
    expect(SRC).toMatch(/public\.current_app_user_role\(\) = 'admin'/);
  });

  it("current_user_in_workspace requires an active workspace_member or admin", () => {
    expect(SRC).toMatch(/CREATE OR REPLACE FUNCTION public\.current_user_in_workspace\(p_workspace_id UUID\)/);
    expect(SRC).toMatch(/workspace_members wm[\s\S]*?wm\.status = 'active'/);
  });

  it("current_user_can_write_workspace excludes viewer role", () => {
    expect(SRC).toMatch(/CREATE OR REPLACE FUNCTION public\.current_user_can_write_workspace/);
    expect(SRC).toMatch(/role IN \('owner', 'admin', 'editor', 'solicitor'\)/);
  });

  it("current_user_can_write_case restricts solicitor to assigned cases", () => {
    expect(SRC).toMatch(/CREATE OR REPLACE FUNCTION public\.current_user_can_write_case\(p_workspace_id UUID, p_assigned_user_id UUID\)/);
    expect(SRC).toMatch(/wm\.role = 'solicitor' AND p_assigned_user_id = public\.current_app_user_id\(\)/);
  });
});

describe("106 RLS — policies exist on every user-data table", () => {
  const REQUIRED_SELECT_POLICIES = [
    "users_self_select",
    "workspaces_member_select",
    "workspace_members_member_select",
    "legal_case_records_member_select",
    "legal_case_facts_member_select",
    "legal_case_documents_member_select",
    "legal_case_drafts_member_select",
    "legal_case_timeline_member_select",
    "legal_case_sources_member_select",
  ];

  for (const p of REQUIRED_SELECT_POLICIES) {
    it(`policy ${p} is created idempotently`, () => {
      expect(SRC).toMatch(new RegExp(`CREATE POLICY ${p}\\b`));
      expect(SRC).toMatch(new RegExp(`policyname = '${p}'`));
    });
  }

  it("legal_case_records_write checks current_user_can_write_case (solicitor assignment)", () => {
    expect(SRC).toMatch(/CREATE POLICY legal_case_records_write[\s\S]*current_user_can_write_case\(workspace_id, assigned_user_id\)/);
  });

  it("child tables enforce write via a parent legal_case_records lookup (no orphan writes)", () => {
    for (const child of ["legal_case_facts", "legal_case_documents", "legal_case_drafts", "legal_case_timeline", "legal_case_sources"]) {
      expect(SRC, `${child} write policy must check parent`).toMatch(
        new RegExp(`CREATE POLICY ${child}_write[\\s\\S]*SELECT 1 FROM public\\.legal_case_records r WHERE r\\.id = ${child}\\.case_id`)
      );
    }
  });
});

describe("106 RLS — admin override is explicit", () => {
  it("admin role bypasses tenant scoping via current_app_user_is_admin()", () => {
    expect(SRC).toMatch(/public\.current_app_user_is_admin\(\)\s+OR EXISTS/);
  });
});

describe("106 RLS — additive + idempotent", () => {
  it("policies created behind pg_policies existence checks", () => {
    expect(SRC).toMatch(/SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_self_select'/);
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

  it("has a matching down migration that drops every policy + disables RLS + drops helpers", () => {
    const downBody = readFileSync(DOWN, "utf8");
    for (const t of USER_DATA_TABLES) {
      expect(downBody).toMatch(new RegExp(`ALTER TABLE public\\.${t}\\s+DISABLE ROW LEVEL SECURITY`));
    }
    for (const fn of [
      "current_user_can_write_case",
      "current_user_can_write_workspace",
      "current_user_in_workspace",
      "current_app_user_is_admin",
      "current_app_user_role",
      "current_app_user_id",
    ]) {
      expect(downBody).toMatch(new RegExp(`DROP FUNCTION IF EXISTS public\\.${fn}`));
    }
  });
});

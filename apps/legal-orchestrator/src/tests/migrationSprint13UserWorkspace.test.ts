// Static safety tests for 104_user_workspace_foundation.sql.
//
// This is the first migration in the canonical chain that introduces
// user-identifying data. The tests below lock the additive contract:
//   * tables exist
//   * required columns exist
//   * CHECK constraints carry the user-approved status / role values
//   * no destructive SQL slipped in
//   * idempotency markers present

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIG = join(__dirname, "../../db/migrations/104_user_workspace_foundation.sql");
const DOWN = join(__dirname, "../../db/migrations/104_user_workspace_foundation.down.sql");
const SRC = readFileSync(MIG, "utf8");

function stripComments(s: string): string {
  return s
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
}

describe("104 user/workspace foundation — tables present", () => {
  it("creates public.users idempotently", () => {
    expect(SRC).toMatch(/CREATE TABLE IF NOT EXISTS public\.users\b/);
  });

  it("creates public.workspaces idempotently", () => {
    expect(SRC).toMatch(/CREATE TABLE IF NOT EXISTS public\.workspaces\b/);
  });

  it("creates public.workspace_members idempotently", () => {
    expect(SRC).toMatch(/CREATE TABLE IF NOT EXISTS public\.workspace_members\b/);
  });
});

describe("104 user/workspace foundation — required columns", () => {
  it("users carries email + status + auth_provider/external_subject", () => {
    for (const col of ["email", "display_name", "status", "auth_provider", "external_subject", "metadata", "created_at", "updated_at"]) {
      expect(SRC, `users missing column: ${col}`).toMatch(new RegExp(`\\b${col}\\b`));
    }
  });

  it("workspaces carries workspace_type, owner_user_id, status, metadata", () => {
    for (const col of ["workspace_type", "owner_user_id", "status", "metadata"]) {
      expect(SRC).toMatch(new RegExp(`\\b${col}\\b`));
    }
  });

  it("workspace_members carries workspace_id, user_id, role, status", () => {
    for (const col of ["workspace_id", "user_id", "role", "status", "invited_at", "joined_at"]) {
      expect(SRC).toMatch(new RegExp(`\\b${col}\\b`));
    }
  });
});

describe("104 user/workspace foundation — CHECK constraints lock the taxonomy", () => {
  it("users.status enum is exactly active/suspended/deleted", () => {
    expect(SRC).toMatch(/status[^()]*CHECK\s*\(status IN \('active',\s*'suspended',\s*'deleted'\)\)/);
  });

  it("workspaces.workspace_type enum is exactly individual/team/organisation/admin", () => {
    expect(SRC).toMatch(/workspace_type[^()]*CHECK\s*\(workspace_type IN \('individual',\s*'team',\s*'organisation',\s*'admin'\)\)/);
  });

  it("workspaces.status enum is exactly active/suspended/archived/deleted", () => {
    expect(SRC).toMatch(/status[^()]*CHECK\s*\(status IN \('active',\s*'suspended',\s*'archived',\s*'deleted'\)\)/);
  });

  it("workspace_members.role enum is exactly owner/admin/editor/viewer/solicitor", () => {
    expect(SRC).toMatch(/role[^()]*CHECK\s*\(role IN \('owner',\s*'admin',\s*'editor',\s*'viewer',\s*'solicitor'\)\)/);
  });

  it("workspace_members.status enum is exactly active/invited/suspended/removed", () => {
    expect(SRC).toMatch(/status[^()]*CHECK\s*\(status IN \('active',\s*'invited',\s*'suspended',\s*'removed'\)\)/);
  });
});

describe("104 user/workspace foundation — FK + uniqueness", () => {
  it("workspaces.owner_user_id references users(id) ON DELETE SET NULL", () => {
    expect(SRC).toMatch(/workspaces_owner_user_id_fkey/);
    expect(SRC).toMatch(/REFERENCES public\.users \(id\)\s+ON DELETE SET NULL/);
  });

  it("workspace_members FK to workspaces ON DELETE CASCADE", () => {
    expect(SRC).toMatch(/workspace_members_workspace_id_fkey/);
    expect(SRC).toMatch(/REFERENCES public\.workspaces \(id\)\s+ON DELETE CASCADE/);
  });

  it("workspace_members FK to users ON DELETE CASCADE", () => {
    expect(SRC).toMatch(/workspace_members_user_id_fkey/);
    expect(SRC).toMatch(/REFERENCES public\.users \(id\)\s+ON DELETE CASCADE/);
  });

  it("workspace_members has a UNIQUE (workspace_id, user_id) constraint", () => {
    expect(SRC).toMatch(/workspace_members_workspace_user_uniq/);
    expect(SRC).toMatch(/UNIQUE \(workspace_id,\s*user_id\)/);
  });
});

describe("104 user/workspace foundation — additive only", () => {
  it("uses CREATE TABLE IF NOT EXISTS everywhere", () => {
    const stripped = stripComments(SRC);
    const creates = [...stripped.matchAll(/CREATE TABLE\b[^;]*/g)];
    for (const m of creates) {
      expect(m[0]).toMatch(/IF NOT EXISTS/);
    }
  });

  it("contains no destructive SQL (DROP/TRUNCATE/DELETE/ALTER … DROP/RENAME) outside comments", () => {
    const stripped = stripComments(SRC);
    expect(stripped).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX|SCHEMA|EXTENSION)\b/i);
    expect(stripped).not.toMatch(/\bTRUNCATE\b/i);
    expect(stripped).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(stripped).not.toMatch(/ALTER\s+TABLE[^\n]*\bDROP\b/i);
    expect(stripped).not.toMatch(/ALTER\s+TABLE[^\n]*\bRENAME\b/i);
  });

  it("does not embed secrets / DATABASE_URL / fetch / curl", () => {
    expect(SRC).not.toMatch(/DATABASE_URL\s*=/i);
    expect(SRC).not.toMatch(/\bfetch\s*\(/i);
    expect(SRC).not.toMatch(/\bcurl\b/i);
    expect(SRC).not.toMatch(/\bwget\b/i);
    expect(SRC).not.toMatch(/postgres(ql)?:\/\/[^\s]+:[^\s]+@/i);
  });

  it("has a matching down migration", () => {
    const downBody = readFileSync(DOWN, "utf8");
    expect(downBody).toMatch(/DROP TABLE IF EXISTS public\.workspace_members/);
    expect(downBody).toMatch(/DROP TABLE IF EXISTS public\.workspaces/);
    expect(downBody).toMatch(/DROP TABLE IF EXISTS public\.users/);
  });
});

describe("104 user/workspace foundation — RLS NOT enabled here", () => {
  it("does NOT enable RLS — that is 106's job", () => {
    expect(SRC).not.toMatch(/ENABLE\s+ROW\s+LEVEL\s+SECURITY/);
    expect(SRC).not.toMatch(/CREATE\s+POLICY/i);
  });
});

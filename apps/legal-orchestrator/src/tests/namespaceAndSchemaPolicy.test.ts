// Repo-level safety net for the IterLaw canonical-architecture
// decision. Asserts:
//   * No active k8s manifest declares `namespace: iterlaw` (the disabled
//     parking directory is exempt).
//   * Active manifests use only canonical namespaces.
//   * The RAG schema canonical-decision document exists and mentions the
//     conflict + reconciliation.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, sep, posix } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

const CANONICAL_NAMESPACES = new Set([
  "iterlaw-ai",
  "iterlaw-rag",
  "iterlaw-api",
  "iterlaw-monitoring",
  "iterlaw-security",
  // Pre-existing IterLaw infra split also includes:
  "iterlaw-data",
]);

function walkYaml(root: string, out: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(root);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(root, name);
    const posixFull = full.split(sep).join(posix.sep);
    // Skip disabled / parked directories at any depth.
    if (
      posixFull.includes("/iterlaw-disabled-") ||
      posixFull.includes("/workflows-disabled/") ||
      /\/disabled\//.test(posixFull)
    ) {
      continue;
    }
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      walkYaml(full, out);
    } else if (/\.ya?ml$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe("k8s namespace policy", () => {
  const k8sRoot = join(REPO_ROOT, "k8s");
  const files = walkYaml(k8sRoot);

  it("walked at least the existing k8s manifests", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("no active manifest declares standalone 'namespace: iterlaw' (without -ai/-rag/...)", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const body = readFileSync(f, "utf8");
      // Strict: line where `namespace: iterlaw` appears with no
      // hyphenated suffix on the same token.
      if (/^\s*namespace:\s*iterlaw\s*$/m.test(body)) {
        offenders.push(f);
      }
    }
    expect(offenders, `unexpected namespace: iterlaw in ${offenders.join(", ")}`).toEqual([]);
  });

  it("every namespace value used in active manifests is canonical", () => {
    const offenders: Array<{ file: string; ns: string }> = [];
    for (const f of files) {
      const body = readFileSync(f, "utf8");
      const m = body.match(/^\s*namespace:\s*([A-Za-z0-9_-]+)\s*$/gm) ?? [];
      for (const line of m) {
        const ns = line.replace(/^\s*namespace:\s*/, "").trim();
        if (!CANONICAL_NAMESPACES.has(ns)) {
          offenders.push({ file: f, ns });
        }
      }
    }
    expect(
      offenders,
      `non-canonical namespaces: ${offenders.map((o) => `${o.ns} (${o.file})`).join(", ")}`
    ).toEqual([]);
  });

  it("the disabled parking directory is present and ignored by the walker", () => {
    const disabled = join(REPO_ROOT, "k8s", "iterlaw-disabled-master-order");
    const readme = join(disabled, "README.md");
    // Disabled directory exists and has its README.
    expect(statSync(disabled).isDirectory()).toBe(true);
    expect(statSync(readme).isFile()).toBe(true);
    // Disabled files do contain `namespace: iterlaw` (the whole point
    // of parking them) — confirm the walker did NOT include them.
    for (const f of files) {
      expect(f).not.toMatch(/iterlaw-disabled-master-order/);
    }
  });
});

describe("RAG schema canonical decision", () => {
  const docPath = join(REPO_ROOT, "docs", "iterlaw", "RAG_SCHEMA_CANONICAL_DECISION.md");

  it("docs/iterlaw/RAG_SCHEMA_CANONICAL_DECISION.md exists", () => {
    expect(statSync(docPath).isFile()).toBe(true);
  });

  it("documents the migration conflict and the canonical decision", () => {
    const body = readFileSync(docPath, "utf8");
    expect(body).toMatch(/CREATE TABLE IF NOT EXISTS/);
    expect(body).toMatch(/conflict/i);
    expect(body).toMatch(/001 chain.*canonical|001-chain is canonical/i);
    expect(body).toMatch(/DO NOT apply.*100_/);
    expect(body).toMatch(/101_reconcile_legal_rag_schema/);
  });

  it("the reconciliation migration exists and is additive only", () => {
    const m101 = join(
      REPO_ROOT,
      "apps",
      "legal-orchestrator",
      "db",
      "migrations",
      "101_reconcile_legal_rag_schema.sql"
    );
    const body = readFileSync(m101, "utf8");
    for (const t of [
      "verified_answers_cache",
      "rag_runs",
      "source_update_log",
      "answer_verification_log",
    ]) {
      expect(body).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${t}\\b`));
    }
    // Additive only — no DROP, no ALTER on the canonical tables.
    for (const t of ["legal_sources", "legal_documents", "legal_chunks", "legal_cases"]) {
      expect(body).not.toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${t}\\b`));
      expect(body).not.toMatch(new RegExp(`(DROP|ALTER) TABLE[^\\n]*${t}`, "i"));
    }
  });

  it("100_* is marked DO NOT APPLY in its own header", () => {
    const m100 = join(
      REPO_ROOT,
      "apps",
      "legal-orchestrator",
      "db",
      "migrations",
      "100_iterlaw_core_rag_foundation.sql"
    );
    const body = readFileSync(m100, "utf8");
    expect(body).toMatch(/DO NOT APPLY/);
    expect(body).toMatch(/superseded by 101_reconcile_legal_rag_schema/);
  });
});

describe("Master-Order example secrets contain no real credentials", () => {
  const root = join(REPO_ROOT, "k8s", "iterlaw-disabled-master-order");

  it("11-postgres-secret.example.yaml only contains REPLACE_ME placeholders", () => {
    const body = readFileSync(join(root, "11-postgres-secret.example.yaml"), "utf8");
    expect(body).toMatch(/REPLACE_ME/);
    // No obviously-real secret patterns.
    expect(body).not.toMatch(/password:\s*['"]?[A-Za-z0-9!@#%^&*()]{8,}['"]?$/m);
  });

  it("21-legal-orchestrator-secret.example.yaml only contains REPLACE_ME placeholders", () => {
    const body = readFileSync(join(root, "21-legal-orchestrator-secret.example.yaml"), "utf8");
    expect(body).toMatch(/REPLACE_ME/);
  });
});

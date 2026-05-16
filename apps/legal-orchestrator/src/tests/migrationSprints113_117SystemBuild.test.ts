import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readMigration(name: string): string {
  return readFileSync(join(__dirname, "../../db/migrations", name), "utf8");
}

describe("migration 113_sprints_22_25_law_engine.sql", () => {
  const sql = readMigration("113_sprints_22_25_law_engine.sql");
  it("creates fusion + calibration + evidence_chain_edges", () => {
    expect(sql).toMatch(/law_module_calculator_fusion_runs/i);
    expect(sql).toMatch(/law_module_reranker_calibration/i);
    expect(sql).toMatch(/evidence_chain_edges/i);
  });
  it("enables RLS and workspace policies", () => {
    expect(sql).toMatch(/current_user_in_workspace\(workspace_id\)/i);
    expect(sql).toMatch(/law_module_reranker_calibration_admin_all/i);
  });
  it("uses pg_trgm on evidence nodes", () => {
    expect(sql).toMatch(/gin_trgm_ops/i);
  });
});

describe("migration 114_sprints_26_34_retrieval_stack.sql", () => {
  const sql = readMigration("114_sprints_26_34_retrieval_stack.sql");
  it("creates hnsw registry + ollama cache + streaming outbox", () => {
    expect(sql).toMatch(/retrieval_hnsw_registry/i);
    expect(sql).toMatch(/ollama_inference_cache/i);
    expect(sql).toMatch(/streaming_chunk_outbox/i);
  });
  it("BRIN on streaming created_at", () => {
    expect(sql).toMatch(/brin \(created_at\)/i);
  });
  it("unique request seq", () => {
    expect(sql).toMatch(/UNIQUE \(request_id, seq\)/i);
  });
});

describe("migration 115_sprints_35_45_wasm_intel.sql", () => {
  const sql = readMigration("115_sprints_35_45_wasm_intel.sql");
  it("wasm registry composite pk", () => {
    expect(sql).toMatch(/wasm_module_registry/i);
    expect(sql).toMatch(/PRIMARY KEY \(module_id, version\)/i);
  });
  it("client_proof_cache user FK + expires", () => {
    expect(sql).toMatch(/client_proof_cache/i);
    expect(sql).toMatch(/expires_at/i);
  });
});

describe("migration 116_sprints_46_51_workspace_temporal.sql", () => {
  const sql = readMigration("116_sprints_46_51_workspace_temporal.sql");
  it("temporal scope + audit", () => {
    expect(sql).toMatch(/case_record_temporal_scope/i);
    expect(sql).toMatch(/workspace_case_access_audit/i);
  });
});

describe("migration 117_sprints_52_57_document_intel.sql", () => {
  const sql = readMigration("117_sprints_52_57_document_intel.sql");
  it("uploads entities chunks", () => {
    expect(sql).toMatch(/document_uploads/i);
    expect(sql).toMatch(/document_entities/i);
    expect(sql).toMatch(/document_chunks/i);
  });
  it("status check on uploads", () => {
    expect(sql).toMatch(/CHECK \(status IN \('pending', 'parsed', 'failed'\)\)/i);
  });
});

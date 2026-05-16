import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DocumentIntelIntegrationPhase58Band, PIPELINE_STAGE_ORDER } from "../coherentSystem/documentIntelIntegrationPhase58.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql154 = readFileSync(join(__dirname, "../../db/migrations/154_sprint58_document_intel_integration.sql"), "utf8");
const band = new DocumentIntelIntegrationPhase58Band();

describe("migration 154 sprint 58", () => {
  it("pipeline_runs table", () => expect(sql154).toMatch(/document_intel_pipeline_runs/i));
  it("stage check constraint", () => expect(sql154).toMatch(/stage IN/i));
  it("upload_id fk", () => expect(sql154).toMatch(/upload_id/i));
  it("latency_ms", () => expect(sql154).toMatch(/latency_ms/i));
  it("rls policies", () => expect(sql154).toMatch(/document_intel_pipeline_ws_select/i));
});

describe("DocumentIntelIntegrationPhase58Band", () => {
  it("pipeline stage order length", () => expect(PIPELINE_STAGE_ORDER).toHaveLength(10));
  it("nextStage from upload", () => expect(band.nextStage("upload")).toBe("ocr"));
  it("nextStage complete is null", () => expect(band.nextStage("complete")).toBeNull());
  it("latency targets", () => {
    expect(band.meetsUploadLatencyTarget(4_999)).toBe(true);
    expect(band.meetsSearchLatencyTarget(999)).toBe(true);
  });
  it("recordStage", () => {
    const r = band.recordStage("up-1", "ocr", 1200);
    expect(r.status).toBe("success");
    expect(r.stage).toBe("ocr");
  });
});

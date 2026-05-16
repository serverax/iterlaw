import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DocumentClassificationPhase54Band } from "../coherentSystem/documentClassificationPhase54.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql150 = readFileSync(join(__dirname, "../../db/migrations/150_sprint54_document_metadata.sql"), "utf8");
const band = new DocumentClassificationPhase54Band();

describe("migration 150 sprint 54", () => {
  it("document_metadata table", () => expect(sql150).toMatch(/CREATE TABLE IF NOT EXISTS public\.document_metadata/i));
  it("primary_category", () => expect(sql150).toMatch(/primary_category/i));
  it("linked_case_id", () => expect(sql150).toMatch(/linked_case_id/i));
  it("urgency check", () => expect(sql150).toMatch(/urgency IN/i));
  it("rls policies", () => expect(sql150).toMatch(/document_metadata_ws_select/i));
});

describe("DocumentClassificationPhase54Band", () => {
  it("employment category", () => {
    const c = band.classifyFromText("employment dismissal letter");
    expect(c.primaryCategory).toBe("employment");
  });
  it("housing category", () => {
    expect(band.classifyFromText("eviction notice tenancy").primaryCategory).toBe("housing");
  });
  it("high urgency on deadline", () => {
    expect(band.classifyFromText("appeal deadline within 7 days").urgency).toBe("high");
  });
});

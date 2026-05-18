import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EntityExtractionPhase52Band } from "../coherentSystem/entityExtractionPhase52.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql148 = readFileSync(join(__dirname, "../../db/migrations/148_sprint52_document_entities_enrichment.sql"), "utf8");
const band = new EntityExtractionPhase52Band();

describe("migration 148 sprint 52", () => {
  it("alters document_entities", () => expect(sql148).toMatch(/ALTER TABLE public\.document_entities/i));
  it("page_number", () => expect(sql148).toMatch(/page_number/i));
  it("bounding_box jsonb", () => expect(sql148).toMatch(/bounding_box/i));
  it("extracted_at", () => expect(sql148).toMatch(/extracted_at/i));
  it("type index", () => expect(sql148).toMatch(/idx_document_entities_sprint52_type/i));
});

describe("EntityExtractionPhase52Band", () => {
  it("classifies date", () => expect(band.classifyEntity("01/05/2026", "")).toBe("date"));
  it("classifies amount", () => expect(band.classifyEntity("£5000", "salary")).toBe("amount"));
  it("classifies clause", () => expect(band.classifyEntity("section 7", "disciplinary procedure")).toBe("clause"));
  it("classifies reference", () => expect(band.classifyEntity("ref. HR-12", "")).toBe("reference"));
  it("extractEntities returns empty prep", async () => {
    expect(await band.extractEntities("doc-1")).toEqual([]);
  });
});

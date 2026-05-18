import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LegalDocumentParsingPhase53Band } from "../coherentSystem/legalDocumentParsingPhase53.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql149 = readFileSync(join(__dirname, "../../db/migrations/149_sprint53_document_analysis.sql"), "utf8");
const band = new LegalDocumentParsingPhase53Band();

describe("migration 149 sprint 53", () => {
  it("document_analysis table", () => expect(sql149).toMatch(/CREATE TABLE IF NOT EXISTS public\.document_analysis/i));
  it("upload_id fk", () => expect(sql149).toMatch(/upload_id/i));
  it("parsed_data jsonb", () => expect(sql149).toMatch(/parsed_data/i));
  it("issues_identified", () => expect(sql149).toMatch(/issues_identified/i));
  it("rls enabled", () => expect(sql149).toMatch(/ENABLE ROW LEVEL SECURITY/i));
  it("ws select policy", () => expect(sql149).toMatch(/document_analysis_ws_select/i));
});

describe("LegalDocumentParsingPhase53Band", () => {
  it("detects redundancy", () => expect(band.detectDocumentType("redundancy consultation")).toBe("redundancy_notice"));
  it("detects disciplinary", () => expect(band.detectDocumentType("disciplinary hearing")).toBe("disciplinary_notice"));
  it("detects dismissal", () => expect(band.detectDocumentType("you are dismissed")).toBe("dismissal_letter"));
  it("parseEmploymentLetter", async () => {
    const r = await band.parseEmploymentLetter("id", "disciplinary notice");
    expect(r.documentType).toBe("disciplinary_notice");
  });
});

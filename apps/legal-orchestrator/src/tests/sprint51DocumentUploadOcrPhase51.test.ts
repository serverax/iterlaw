import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DOCUMENT_OCR_CONFIDENCE_REVIEW_THRESHOLD,
  DOCUMENT_UPLOAD_MAX_BYTES,
  DocumentUploadOcrPhase51Band,
} from "../coherentSystem/documentUploadOcrPhase51.js";
import { Zone2DocumentServiceStub } from "../coherentSystem/zone2DocumentStub.js";
import { delegatingZone2Document } from "./helpers/zone2DocumentTestDouble.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql147 = readFileSync(join(__dirname, "../../db/migrations/147_sprint51_document_upload_ocr.sql"), "utf8");

describe("migration 147 sprint 51", () => {
  it("alters document_uploads", () => expect(sql147).toMatch(/ALTER TABLE public\.document_uploads/i));
  it("case_id column", () => expect(sql147).toMatch(/case_id/i));
  it("raw_text column", () => expect(sql147).toMatch(/raw_text/i));
  it("confidence_score column", () => expect(sql147).toMatch(/confidence_score/i));
  it("expires_at column", () => expect(sql147).toMatch(/expires_at/i));
  it("file_name column", () => expect(sql147).toMatch(/file_name/i));
  it("file_size column", () => expect(sql147).toMatch(/file_size/i));
  it("sprint51 case index", () => expect(sql147).toMatch(/idx_document_uploads_sprint51_case/i));
  it("sprint51 expires index", () => expect(sql147).toMatch(/idx_document_uploads_sprint51_expires/i));
});

describe("DocumentUploadOcrPhase51Band", () => {
  const band = new DocumentUploadOcrPhase51Band(new Zone2DocumentServiceStub());

  it("rejects oversized file", () => {
    const r = band.validateUpload({
      fileName: "a.pdf",
      mimeType: "application/pdf",
      fileSize: DOCUMENT_UPLOAD_MAX_BYTES + 1,
      storageKey: "k1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("file_too_large");
    }
  });

  it("rejects invalid mime", () => {
    const r = band.validateUpload({
      fileName: "a.bin",
      mimeType: "application/octet-stream",
      fileSize: 100,
      storageKey: "k1",
    });
    expect(r.ok).toBe(false);
  });

  it("accepts valid pdf upload", () => {
    const r = band.validateUpload({
      fileName: "letter.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
      storageKey: "uploads/letter.pdf",
    });
    expect(r.ok).toBe(true);
  });

  it("manual review below threshold", () => {
    expect(band.needsManualReview(DOCUMENT_OCR_CONFIDENCE_REVIEW_THRESHOLD - 0.01)).toBe(true);
    expect(band.needsManualReview(0.95)).toBe(false);
  });

  it("extractTextOcr returns stub text", async () => {
    const ocr = await band.extractTextOcr("uploads/x.pdf", "application/pdf");
    expect(ocr.rawText).toContain("stub-ocr");
    expect(ocr.confidenceScore).toBeGreaterThan(0);
  });

  it("delegates to zone2 test double", async () => {
    const custom = new DocumentUploadOcrPhase51Band(
      delegatingZone2Document({
        async runDocumentOcr() {
          return { text: "custom", confidence: 0.5, timedOut: false };
        },
      }),
    );
    const ocr = await custom.extractTextOcr("k", "application/pdf");
    expect(ocr.rawText).toBe("custom");
    expect(ocr.needsManualReview).toBe(true);
  });
});

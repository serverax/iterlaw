import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import {
  DOCUMENT_OCR_CONFIDENCE_REVIEW_THRESHOLD,
  DOCUMENT_UPLOAD_MAX_BYTES,
  DocumentUploadOcrPhase51Band,
} from "../coherentSystem/documentUploadOcrPhase51.js";
import { Zone2DocumentServiceStub } from "../coherentSystem/zone2DocumentStub.js";
import { readAzureDocumentIntelligenceConfigFromEnv } from "../coherentSystem/azureDocumentIntelligenceZone2.js";
import { DocumentUploadService, DocumentUploadError, manualReviewRequired } from "../documents/documentUploadService.js";
import { InMemoryDocumentUploadStore } from "../documents/documentUploadStore.js";
import { delegatingZone2Document } from "./helpers/zone2DocumentTestDouble.js";
import { createApp } from "../server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql147 = readFileSync(join(__dirname, "../../db/migrations/147_sprint51_document_upload_ocr.sql"), "utf8");
const sql147down = readFileSync(join(__dirname, "../../db/migrations/147_sprint51_document_upload_ocr.down.sql"), "utf8");
const U1 = "00000000-0000-4000-8000-000000000001";
const W1 = "00000000-0000-4000-8000-000000000010";

function service(zone2 = new Zone2DocumentServiceStub()): DocumentUploadService {
  return new DocumentUploadService(zone2, new InMemoryDocumentUploadStore());
}

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
  it("down drops columns", () => {
    expect(sql147down).toMatch(/DROP COLUMN IF EXISTS raw_text/i);
    expect(sql147down).toMatch(/DROP COLUMN IF EXISTS case_id/i);
  });
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
    if (!r.ok) expect(r.reason).toBe("file_too_large");
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
    expect(ocr.timedOut).toBe(false);
  });

  it("extractTextOcr uses file content when provided", async () => {
    const ocr = await band.extractTextOcr("k", "text/plain", Buffer.from("Appeal within 7 days", "utf8"));
    expect(ocr.rawText).toContain("Appeal within 7 days");
  });
});

describe("DocumentUploadService", () => {
  it("uploadDocument returns record", async () => {
    const svc = service();
    const rec = await svc.uploadDocument(Buffer.from("hello"), U1, W1, "a.txt", "text/plain");
    expect(rec.userId).toBe(U1);
    expect(rec.workspaceId).toBe(W1);
    expect(rec.fileName).toBe("a.txt");
    expect(rec.rawText.length).toBeGreaterThan(0);
  });

  it("optional case_id", async () => {
    const rec = await service().uploadDocument(
      Buffer.from("x"),
      U1,
      W1,
      "b.pdf",
      "application/pdf",
      "00000000-0000-4000-8000-000000000099",
    );
    expect(rec.caseId).toBe("00000000-0000-4000-8000-000000000099");
  });

  it("rejects invalid mime via service", async () => {
    await expect(
      service().uploadDocument(Buffer.from("x"), U1, W1, "a.bin", "application/octet-stream"),
    ).rejects.toMatchObject({ code: "invalid_mime", statusCode: 400 });
  });

  it("expires_at ~24h", async () => {
    const rec = await service().uploadDocument(Buffer.from("x"), U1, W1, "a.txt", "text/plain");
    const delta = rec.expiresAt.getTime() - rec.uploadedAt.getTime();
    expect(delta).toBeGreaterThanOrEqual(23 * 60 * 60 * 1000);
    expect(delta).toBeLessThanOrEqual(25 * 60 * 60 * 1000);
  });

  it("getDocumentMetadata", async () => {
    const svc = service();
    const rec = await svc.uploadDocument(Buffer.from("meta"), U1, W1, "m.txt", "text/plain");
    const meta = svc.getDocumentMetadata(rec.id);
    expect(meta.fileName).toBe("m.txt");
    expect(meta.confidenceScore).toBeGreaterThan(0);
  });

  it("document_not_found", () => {
    expect(() => service().getDocumentMetadata("00000000-0000-4000-8000-000000009999")).toThrow(DocumentUploadError);
  });

  it("low confidence flags manual review", async () => {
    const svc = service(
      delegatingZone2Document({
        async runDocumentOcr() {
          return { text: "low", confidence: 0.5, timedOut: false };
        },
      }),
    );
    const rec = await svc.uploadDocument(Buffer.from("x"), U1, W1, "a.txt", "text/plain");
    expect(rec.needsManualReview).toBe(true);
    expect(manualReviewRequired(rec.confidenceScore)).toBe(true);
  });

  it("extractTextOcr by id", async () => {
    const svc = service();
    const rec = await svc.uploadDocument(Buffer.from("ocr-me"), U1, W1, "a.txt", "text/plain");
    const text = await svc.extractTextOcr(rec.id);
    expect(text.length).toBeGreaterThan(0);
  });

  it("uuid id", async () => {
    const rec = await service().uploadDocument(Buffer.from("x"), U1, W1, "a.txt", "text/plain");
    expect(rec.id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("Sprint 51 — index export", () => {
  it("documentUploadOcrPhase51Band", async () => {
    const idx = await import("../coherentSystem/index.js");
    expect(idx.documentUploadOcrPhase51Band).toBeDefined();
  });
});

describe("Sprint 51 — Azure env config reader", () => {
  it("returns null when env missing", () => {
    const prev = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
    delete process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
    expect(readAzureDocumentIntelligenceConfigFromEnv()).toBeNull();
    if (prev) process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = prev;
  });
});

describe("Sprint 51 — POST /api/documents/upload", () => {
  it("uploads file", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/documents/upload")
      .field("user_id", U1)
      .field("workspace_id", W1)
      .attach("file", Buffer.from("Dismissal effective Monday"), {
        filename: "letter.txt",
        contentType: "text/plain",
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(res.body.file_name).toBe("letter.txt");
    expect(typeof res.body.confidence_score).toBe("number");
    expect(res.body.raw_text).toBeTruthy();
  });

  it("missing file 400", async () => {
    const res = await request(createApp()).post("/api/documents/upload").field("user_id", U1).field("workspace_id", W1);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("missing_file");
  });

  it("invalid mime 400", async () => {
    const res = await request(createApp())
      .post("/api/documents/upload")
      .field("user_id", U1)
      .field("workspace_id", W1)
      .attach("file", Buffer.from("x"), { filename: "x.bin", contentType: "application/octet-stream" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_mime");
  });

  it("missing user_id 400", async () => {
    const res = await request(createApp())
      .post("/api/documents/upload")
      .field("workspace_id", W1)
      .attach("file", Buffer.from("x"), { filename: "x.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
  });

  it("GET metadata", async () => {
    const app = createApp();
    const up = await request(app)
      .post("/api/documents/upload")
      .field("user_id", U1)
      .field("workspace_id", W1)
      .attach("file", Buffer.from("content"), { filename: "c.txt", contentType: "text/plain" });
    const res = await request(app).get(`/api/documents/${up.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.file_name).toBe("c.txt");
  });
});

describe("DocumentUploadOcrPhase51Band — validation matrix", () => {
  const band = new DocumentUploadOcrPhase51Band(new Zone2DocumentServiceStub());
  it("rejects empty fileName", () => {
    expect(band.validateUpload({ fileName: "  ", mimeType: "text/plain", fileSize: 1, storageKey: "k" }).ok).toBe(false);
  });
  it("rejects empty storageKey", () => {
    expect(band.validateUpload({ fileName: "a.txt", mimeType: "text/plain", fileSize: 1, storageKey: "" }).ok).toBe(false);
  });
  it("accepts docx mime", () => {
    expect(
      band.validateUpload({
        fileName: "a.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileSize: 100,
        storageKey: "k",
      }).ok,
    ).toBe(true);
  });
  it("accepts pdf at max size", () => {
    expect(
      band.validateUpload({
        fileName: "big.pdf",
        mimeType: "application/pdf",
        fileSize: DOCUMENT_UPLOAD_MAX_BYTES,
        storageKey: "k",
      }).ok,
    ).toBe(true);
  });
  it("threshold boundary 0.7 not review", () => {
    expect(band.needsManualReview(0.7)).toBe(false);
  });
  it("threshold boundary below review", () => {
    expect(band.needsManualReview(0.699)).toBe(true);
  });
});

describe("DocumentUploadService — store isolation", () => {
  it("two uploads distinct ids", async () => {
    const store = new InMemoryDocumentUploadStore();
    const svc = new DocumentUploadService(new Zone2DocumentServiceStub(), store);
    const a = await svc.uploadDocument(Buffer.from("a"), U1, W1, "a.txt", "text/plain");
    const b = await svc.uploadDocument(Buffer.from("b"), U1, W1, "b.txt", "text/plain");
    expect(a.id).not.toBe(b.id);
  });
});

describe("Sprint 51 — ocr timeout path", () => {
  it("pending_async when zone2 times out", async () => {
    vi.useFakeTimers();
    const slow = delegatingZone2Document({
      runDocumentOcr: () => new Promise(() => {}),
    });
    const svc = service(slow);
    const pending = svc.uploadDocument(Buffer.from("slow"), U1, W1, "s.txt", "text/plain");
    await vi.advanceTimersByTimeAsync(31_000);
    const rec = await pending;
    expect(rec.ocrStatus).toBe("pending_async");
    vi.useRealTimers();
  });
});

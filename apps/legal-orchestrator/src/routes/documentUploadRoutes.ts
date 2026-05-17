import type { Express, Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { DocumentUploadError, DocumentUploadService } from "../documents/documentUploadService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export interface DocumentUploadRoutesOptions {
  readonly documentUploadService: DocumentUploadService;
}

export function registerDocumentUploadRoutes(app: Express, opts: DocumentUploadRoutesOptions): void {
  const { documentUploadService } = opts;

  const fieldsSchema = z.object({
    user_id: z.string().min(1),
    workspace_id: z.string().min(1),
    case_id: z.string().optional(),
  });

  app.post(
    "/api/documents/upload",
    upload.single("file"),
    async (req: Request, res: Response) => {
      if (!req.file) {
        res.status(400).json({ error: "missing_file" });
        return;
      }
      const parsed = fieldsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_request", details: parsed.error.issues });
        return;
      }
      try {
        const record = await documentUploadService.uploadDocument(
          req.file.buffer,
          parsed.data.user_id,
          parsed.data.workspace_id,
          req.file.originalname || "upload.bin",
          req.file.mimetype || "application/octet-stream",
          parsed.data.case_id,
        );
        res.status(201).json({
          id: record.id,
          file_name: record.fileName,
          confidence_score: record.confidenceScore,
          raw_text: record.rawText,
          needs_manual_review: record.needsManualReview,
          ocr_status: record.ocrStatus,
          expires_at: record.expiresAt.toISOString(),
        });
      } catch (err) {
        if (err instanceof DocumentUploadError) {
          res.status(err.statusCode).json({ error: err.code });
          return;
        }
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  app.get("/api/documents/:id", (req: Request, res: Response) => {
    try {
      const meta = documentUploadService.getDocumentMetadata(String(req.params.id));
      res.status(200).json({
        id: meta.id,
        file_name: meta.fileName,
        mime_type: meta.mimeType,
        file_size: meta.fileSize,
        confidence_score: meta.confidenceScore,
        needs_manual_review: meta.needsManualReview,
        ocr_status: meta.ocrStatus,
        uploaded_at: meta.uploadedAt.toISOString(),
        expires_at: meta.expiresAt.toISOString(),
      });
    } catch (err) {
      if (err instanceof DocumentUploadError) {
        res.status(err.statusCode).json({ error: err.code });
        return;
      }
      res.status(500).json({ error: "internal_error" });
    }
  });
}

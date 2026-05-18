import { randomUUID } from "node:crypto";
import {
  DOCUMENT_OCR_CONFIDENCE_REVIEW_THRESHOLD,
  DocumentUploadOcrPhase51Band,
} from "../coherentSystem/documentUploadOcrPhase51.js";
import type { Zone2DocumentService } from "../coherentSystem/zone2DocumentTypes.js";
import type { DocumentUploadStore } from "./documentUploadStore.js";

export type DocumentOcrStatus = "complete" | "pending_async" | "failed";

export interface DocumentRecord {
  readonly id: string;
  readonly userId: string;
  readonly workspaceId: string;
  readonly caseId: string | null;
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSize: number;
  readonly storageKey: string;
  readonly rawText: string;
  readonly confidenceScore: number;
  readonly needsManualReview: boolean;
  readonly ocrStatus: DocumentOcrStatus;
  readonly uploadedAt: Date;
  readonly expiresAt: Date;
}

export interface DocumentMetadata {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSize: number;
  readonly confidenceScore: number;
  readonly needsManualReview: boolean;
  readonly ocrStatus: DocumentOcrStatus;
  readonly uploadedAt: Date;
  readonly expiresAt: Date;
}

export const DOCUMENT_RETENTION_MS = 24 * 60 * 60 * 1000;

export class DocumentUploadService {
  private readonly band: DocumentUploadOcrPhase51Band;

  constructor(
    zone2: Zone2DocumentService,
    private readonly store: DocumentUploadStore,
  ) {
    this.band = new DocumentUploadOcrPhase51Band(zone2);
  }

  async uploadDocument(
    file: Buffer,
    userId: string,
    workspaceId: string,
    fileName: string,
    mimeType: string,
    caseId?: string | null,
  ): Promise<DocumentRecord> {
    const storageKey = `uploads/${workspaceId}/${randomUUID()}/${fileName}`;
    const validation = this.band.validateUpload({
      fileName,
      mimeType,
      fileSize: file.length,
      storageKey,
    });
    if (!validation.ok) {
      throw new DocumentUploadError(validation.reason, 400);
    }
    const ocr = await this.band.extractTextOcr(storageKey, mimeType, file);
    const uploadedAt = new Date();
    const ocrStatus: DocumentOcrStatus = ocr.timedOut
      ? "pending_async"
      : ocr.rawText
        ? "complete"
        : "failed";
    const record: DocumentRecord = {
      id: randomUUID(),
      userId: userId.trim(),
      workspaceId: workspaceId.trim(),
      caseId: caseId?.trim() || null,
      fileName: fileName.trim(),
      mimeType: mimeType.trim(),
      fileSize: file.length,
      storageKey,
      rawText: ocr.rawText,
      confidenceScore: ocr.confidenceScore,
      needsManualReview: ocr.needsManualReview,
      ocrStatus,
      uploadedAt,
      expiresAt: new Date(uploadedAt.getTime() + DOCUMENT_RETENTION_MS),
    };
    this.store.save(record);
    return record;
  }

  async extractTextOcr(documentId: string): Promise<string> {
    const record = this.requireRecord(documentId);
    const ocr = await this.band.extractTextOcr(record.storageKey, record.mimeType);
    if (ocr.timedOut) {
      throw new DocumentUploadError("ocr_timeout", 504);
    }
    return ocr.rawText;
  }

  getDocumentMetadata(documentId: string): DocumentMetadata {
    const record = this.requireRecord(documentId);
    return {
      id: record.id,
      fileName: record.fileName,
      mimeType: record.mimeType,
      fileSize: record.fileSize,
      confidenceScore: record.confidenceScore,
      needsManualReview: record.needsManualReview,
      ocrStatus: record.ocrStatus,
      uploadedAt: record.uploadedAt,
      expiresAt: record.expiresAt,
    };
  }

  isExpired(record: DocumentRecord, nowMs = Date.now()): boolean {
    return record.expiresAt.getTime() <= nowMs;
  }

  private requireRecord(documentId: string): DocumentRecord {
    const record = this.store.getById(documentId);
    if (!record) {
      throw new DocumentUploadError("document_not_found", 404);
    }
    if (this.isExpired(record)) {
      throw new DocumentUploadError("document_expired", 410);
    }
    return record;
  }
}

export class DocumentUploadError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(code);
    this.name = "DocumentUploadError";
  }
}

export function manualReviewRequired(confidence: number): boolean {
  return confidence < DOCUMENT_OCR_CONFIDENCE_REVIEW_THRESHOLD;
}

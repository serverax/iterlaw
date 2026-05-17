import { documentUploadMimeAllowed } from "./documentIntelBand.js";
import type { Zone2DocumentService } from "./zone2DocumentTypes.js";

export const DOCUMENT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_OCR_CONFIDENCE_REVIEW_THRESHOLD = 0.7;
export const DOCUMENT_OCR_TIMEOUT_MS = 30_000;

export interface DocumentUploadInput {
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSize: number;
  readonly storageKey: string;
}

export interface DocumentUploadRecord {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSize: number;
  readonly rawText: string;
  readonly confidenceScore: number;
  readonly needsManualReview: boolean;
}

/**
 * Sprint 51 — Document upload validation + OCR (Zone 2 Azure DI stub).
 */
export class DocumentUploadOcrPhase51Band {
  constructor(private readonly zone2: Zone2DocumentService) {}

  validateUpload(input: DocumentUploadInput): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
    if (input.fileSize > DOCUMENT_UPLOAD_MAX_BYTES) {
      return { ok: false, reason: "file_too_large" };
    }
    if (!documentUploadMimeAllowed(input.mimeType)) {
      return { ok: false, reason: "invalid_mime" };
    }
    if (!input.fileName.trim() || !input.storageKey.trim()) {
      return { ok: false, reason: "missing_fields" };
    }
    return { ok: true };
  }

  needsManualReview(confidence: number): boolean {
    return confidence < DOCUMENT_OCR_CONFIDENCE_REVIEW_THRESHOLD;
  }

  async extractTextOcr(
    storageKey: string,
    mimeType: string,
    content?: Buffer,
  ): Promise<{ readonly rawText: string; readonly confidenceScore: number; readonly needsManualReview: boolean; readonly timedOut: boolean }> {
    const ocr = await this.runOcrWithTimeout({ storageKey, mimeType, content });
    const confidenceScore = Math.min(1, Math.max(0, ocr.confidence));
    return {
      rawText: ocr.text,
      confidenceScore,
      needsManualReview: this.needsManualReview(confidenceScore),
      timedOut: ocr.timedOut,
    };
  }

  private async runOcrWithTimeout(request: {
    readonly storageKey: string;
    readonly mimeType: string;
    readonly content?: Buffer;
  }): Promise<{ readonly text: string; readonly confidence: number; readonly timedOut: boolean }> {
    const timeoutMs = DOCUMENT_OCR_TIMEOUT_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const ocrPromise = this.zone2.runDocumentOcr(request);
      const timeoutPromise = new Promise<{ readonly text: string; readonly confidence: number; readonly timedOut: boolean }>(
        (resolve) => {
          timer = setTimeout(() => resolve({ text: "", confidence: 0, timedOut: true }), timeoutMs);
        },
      );
      const result = await Promise.race([ocrPromise, timeoutPromise]);
      return { text: result.text, confidence: result.confidence, timedOut: result.timedOut ?? false };
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }
}

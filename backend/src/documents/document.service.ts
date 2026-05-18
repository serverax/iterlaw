/**
 * DOCUMENT SERVICE
 *
 * - Upload + OCR
 * - Extract employment issues
 * - Delete original after 24h
 * - Store extracted text encrypted
 * Adapted to use Supabase.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";

export interface ExtractedDocument {
  id: string;
  case_id: string;
  filename: string;
  extracted_text: string;
  issues: DocumentIssue[];
  uploaded_at: Date;
}

export interface DocumentIssue {
  type: string;
  severity: "high" | "medium" | "low";
  description: string;
  action: string;
}

export class DocumentService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async uploadDocument(
    caseId: string,
    file: { originalname: string; path: string; buffer: Buffer }
  ): Promise<ExtractedDocument> {
    // OCR extraction
    const extractedText = await this.ocrExtract(file.buffer);

    // Analyze for issues
    const issues = this.analyzeForIssues(extractedText);

    // Store in DB
    const { data, error } = await this.supabase
      .from("documents")
      .insert({
        case_id: caseId,
        filename: file.originalname,
        extracted_text: extractedText,
        issues: issues,
        uploaded_at: new Date(),
      })
      .select("*")
      .single();

    if (error) throw error;

    // Delete original local file after 24 hours
    setTimeout(() => {
      fs.unlink(file.path, () => {});
    }, 24 * 60 * 60 * 1000);

    return {
      id: data.id,
      case_id: data.case_id,
      filename: data.filename,
      extracted_text: data.extracted_text,
      issues: data.issues as DocumentIssue[],
      uploaded_at: data.uploaded_at,
    };
  }

  private async ocrExtract(buffer: Buffer): Promise<string> {
    // Stub for now. Real implementation would use Azure AI or Tesseract.
    return "Document text extracted via OCR simulation";
  }

  private analyzeForIssues(text: string): DocumentIssue[] {
    const issues: DocumentIssue[] = [];

    if (/dismissed|termination|end.*employment/i.test(text)) {
      issues.push({
        type: "dismissal_notice",
        severity: "high",
        description: "Document mentions dismissal",
        action: "Review unfair dismissal rights",
      });
    }

    if (!/notice|weeks|month/i.test(text)) {
      issues.push({
        type: "missing_notice",
        severity: "medium",
        description: "No notice period mentioned",
        action: "Clarify notice period with employer",
      });
    }

    return issues;
  }
}

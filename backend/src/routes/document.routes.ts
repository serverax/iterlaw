import { Router, type Request, type Response, type NextFunction } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { analyzeEmploymentDocument, extractIssuesFromDocument } from '../services/ocr-service';
import { scheduleDocumentImageDeletion } from '../services/document-lifecycle';

function getSb(req: Request): SupabaseClient {
  const sb = req.app.locals.supabase as SupabaseClient;
  if (!sb) throw new Error('Supabase client missing');
  return sb;
}

export function createDocumentRouter(): Router {
  const r = Router();

  r.post('/upload', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { case_id, filename, content_base64 } = req.body as {
        case_id?: string;
        filename?: string;
        content_base64?: string;
      };
      if (!case_id || !filename || !content_base64) {
        res.status(400).json({ ok: false, error: 'case_id, filename, content_base64 required' });
        return;
      }

      const buffer = Buffer.from(content_base64, 'base64');
      const ocrResult = await analyzeEmploymentDocument(buffer);
      const issues = await extractIssuesFromDocument(ocrResult);
      const sb = getSb(req);
      const docId = `doc_${Date.now()}`;

      const { error } = await sb.from('documents').insert({
        id: docId,
        case_id,
        filename,
        extracted_text: ocrResult.fullText,
        detected_issues: issues,
        uploaded_at: new Date().toISOString(),
      });
      if (error) throw error;

      scheduleDocumentImageDeletion(docId, async () => {
        await sb.from('document_images').delete().eq('document_id', docId);
      });

      res.status(201).json({
        ok: true,
        document_id: docId,
        issues,
        confidence: ocrResult.confidence,
      });
    } catch (err) {
      next(err);
    }
  });

  return r;
}

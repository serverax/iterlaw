import { Router, type Request, type Response, type NextFunction } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateCaseSummaryPdf } from '../services/case-summary-pdf';
import { sendNotification } from '../services/notifications';

function getSb(req: Request): SupabaseClient {
  const sb = req.app.locals.supabase as SupabaseClient;
  if (!sb) throw new Error('Supabase client missing');
  return sb;
}

export function createEscalationRouter(): Router {
  const r = Router();

  r.post('/case-summary', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as {
        case_id?: string;
        user_id?: string;
        jurisdiction?: string;
        timeline?: Array<{ date: string; event: string }>;
        questions?: Array<{ id: string; text: string; confidence?: number }>;
      };
      if (!body.case_id || !body.user_id) {
        res.status(400).json({ ok: false, error: 'case_id and user_id required' });
        return;
      }

      const sb = getSb(req);
      let pdf: Buffer;
      try {
        const { generateCaseSummaryPDF } = await import('../services/case-summary-pdf');
        pdf = await generateCaseSummaryPDF(body.case_id, sb);
      } catch {
        pdf = await generateCaseSummaryPdf({
          caseId: body.case_id,
          userId: body.user_id,
          jurisdiction: body.jurisdiction ?? 'England and Wales',
          timeline: body.timeline ?? [],
          questions: body.questions ?? [],
        });
      }

      await sendNotification({
        userId: body.user_id,
        title: 'Case escalated',
        body: `Summary PDF generated for case ${body.case_id}`,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="case-${body.case_id}.pdf"`);
      res.send(pdf);
    } catch (err) {
      next(err);
    }
  });

  return r;
}

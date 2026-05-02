import type { SupabaseClient } from '@supabase/supabase-js';
import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  approveAnswerSchema,
  approveWithDisclaimerSchema,
  enqueueForLegalReviewSchema,
  rejectAnswerSchema,
} from '../types/legalReview';
import {
  approveAnswer,
  approveWithDisclaimer,
  enqueueForLegalReview,
  listPendingLegalReviews,
  rejectAnswer,
} from '../services/legalReviewService';

function supabase(req: Request): SupabaseClient {
  return req.app.locals.supabase;
}

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}

export function createLegalReviewRouter(): Router {
  const r = Router();

  r.get(
    '/pending',
    asyncHandler(async (req, res) => {
      const data = await listPendingLegalReviews(supabase(req));
      res.json({ ok: true, data });
    })
  );

  r.post(
    '/enqueue',
    asyncHandler(async (req, res) => {
      const input = enqueueForLegalReviewSchema.parse(req.body);
      const data = await enqueueForLegalReview(supabase(req), input);
      res.status(201).json({ ok: true, data });
    })
  );

  r.post(
    '/:queueId/approve',
    asyncHandler(async (req, res) => {
      const input = approveAnswerSchema.parse({
        ...req.body,
        review_queue_id: req.params.queueId,
      });
      await approveAnswer(supabase(req), input);
      res.json({ ok: true, data: { completed: true } });
    })
  );

  r.post(
    '/:queueId/approve-with-disclaimer',
    asyncHandler(async (req, res) => {
      const input = approveWithDisclaimerSchema.parse({
        ...req.body,
        review_queue_id: req.params.queueId,
      });
      await approveWithDisclaimer(supabase(req), input);
      res.json({ ok: true, data: { completed: true } });
    })
  );

  r.post(
    '/:queueId/reject',
    asyncHandler(async (req, res) => {
      const input = rejectAnswerSchema.parse({
        ...req.body,
        review_queue_id: req.params.queueId,
      });
      await rejectAnswer(supabase(req), input);
      res.json({ ok: true, data: { completed: true } });
    })
  );

  return r;
}

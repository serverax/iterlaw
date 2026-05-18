import type { Express, NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createControlledAskJsonGuard } from '../middleware/controlledAskJsonGuard';
import {
  logAskRequest,
  outcomeToWireResponse,
  runControlledAsk,
  wireResponseMeta,
} from '../services/controlledAskService';
import { askBodySchema } from '../types/controlledAsk';

function getSb(req: Request): SupabaseClient {
  const sb = req.app.locals.supabase as SupabaseClient | undefined;
  if (!sb) throw new Error('Supabase client missing on app.locals');
  return sb;
}

async function postAsk(req: Request, res: Response): Promise<void> {
  const parsed = askBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.locals.__skipAskWireGuard = true;
    res.status(400).json({
      ok: false,
      error: { code: 'VALIDATION', message: parsed.error.flatten().fieldErrors },
    });
    return;
  }

  const sb = getSb(req);
  const outcome = await runControlledAsk(sb, parsed.data);
  const wire = outcomeToWireResponse(outcome);
  const meta = wireResponseMeta(wire);

  const userId = (parsed.data as { user_id?: string }).user_id;
  if (userId) {
    try {
      const { awardLoyaltyPointsForQuestion } = await import('../services/loyalty-engine');
      await awardLoyaltyPointsForQuestion(sb, userId);
    } catch {
      // loyalty tables may be absent in local dev
    }
  }

  await logAskRequest(sb, {
    question: parsed.data.question,
    source_used: meta.source_used,
    response_type: meta.response_type,
  });

  console.log(
    JSON.stringify({
      event: 'controlled_ask',
      question: parsed.data.question.slice(0, 500),
      source_used: meta.source_used,
      response_type: meta.response_type,
    })
  );

  res.status(200).json(wire);
}

export function createAskRouter(): Router {
  const r = Router();
  r.use(createControlledAskJsonGuard());
  r.post('/', (req: Request, res: Response, next: NextFunction) => {
    void postAsk(req, res).catch(next);
  });
  return r;
}

export function registerAskRoutes(app: Express): void {
  app.use('/ask', createAskRouter());
}

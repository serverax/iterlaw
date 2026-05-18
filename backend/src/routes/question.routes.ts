import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  applySubscriptionDiscount,
  awardPointsForQuestion,
  resolveLoyaltyTier,
} from '../services/loyalty-engine';

export function createQuestionRouter(): Router {
  const r = Router();

  r.post('/loyalty-preview', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { points = 0, plan = 'essential', base_price_pence = 999 } = req.body as {
        points?: number;
        plan?: 'free' | 'essential' | 'active_case';
        base_price_pence?: number;
      };
      const tier = resolveLoyaltyTier(points);
      const pricing = applySubscriptionDiscount(base_price_pence, tier, plan);
      const nextPoints = awardPointsForQuestion(points, false);
      res.json({ ok: true, tier, next_points: nextPoints, ...pricing });
    } catch (err) {
      next(err);
    }
  });

  return r;
}

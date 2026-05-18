import { Router, type Request, type Response, type NextFunction } from 'express';
import { calculateUserTier, getTierInfo } from '../services/loyalty-engine';

export function createQuestionRouter(): Router {
  const r = Router();

  r.post('/loyalty-preview', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { points = 0, plan = 'essential', base_price_pence = 999 } = req.body as {
        points?: number;
        plan?: string;
        base_price_pence?: number;
      };
      const tier = calculateUserTier(points);
      const tierInfo = getTierInfo(tier);
      const discountPercent = tierInfo.discountPercent;
      const finalPricePence = Math.round(base_price_pence * (1 - discountPercent / 100));
      res.json({
        ok: true,
        tier,
        discountPercent,
        finalPricePence,
        freeQuestionsPerMonth: tierInfo.freeQuestionsPerMonth,
        plan,
      });
    } catch (err) {
      next(err);
    }
  });

  return r;
}

import type { Express } from 'express';
import { registerAskRoutes } from './ask.routes';
import { createLegalReviewRouter } from './legalReview.routes';

export function registerApiRoutes(app: Express): void {
  registerAskRoutes(app);
  app.use('/api/legal-review', createLegalReviewRouter());
}

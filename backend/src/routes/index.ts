import type { Express } from 'express';
import { createLegalReviewRouter } from './legalReview.routes';

export function registerApiRoutes(app: Express): void {
  app.use('/api/legal-review', createLegalReviewRouter());
}

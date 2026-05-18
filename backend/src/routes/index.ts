import type { Express } from 'express';
import { registerAskRoutes } from './ask.routes';
import { createLegalReviewRouter } from './legalReview.routes';
import authRoutes from './auth.routes';
import caseRoutes from './cases.routes';
import { createDocumentRouter } from './document.routes';
import { createQuestionRouter } from './question.routes';
import { createEscalationRouter } from './escalation.routes';

export function registerApiRoutes(app: Express): void {
  registerAskRoutes(app);
  app.use('/api/legal-review', createLegalReviewRouter());
  app.use('/api/auth', authRoutes);
  app.use('/api/cases', caseRoutes);
  app.use('/api/documents', createDocumentRouter());
  app.use('/api/questions', createQuestionRouter());
  app.use('/api/escalation', createEscalationRouter());
}

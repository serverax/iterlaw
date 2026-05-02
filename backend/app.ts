import cors from 'cors';
import express, { type Express } from 'express';
import type { Env } from './src/config/env';
import { createServiceSupabase } from './src/config/supabase';
import { errorHandler } from './src/middleware/errorHandler';
import { healthRouter } from './src/routes/health';
import { registerApiRoutes } from './src/routes';

export function createApp(env: Env): Express {
  const app = express();

  app.locals.supabase = createServiceSupabase(env);

  app.use(cors());
  app.use(express.json({ limit: '512kb' }));

  app.use(healthRouter);
  registerApiRoutes(app);

  app.use(errorHandler);

  return app;
}

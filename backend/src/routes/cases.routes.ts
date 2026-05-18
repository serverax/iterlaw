import { Router, type Request, type Response } from 'express';

const router = Router();

router.get('/current', (_req: Request, res: Response) => {
  res.json({ ok: true, case: null });
});

router.get('/timeline', (_req: Request, res: Response) => {
  res.json([]);
});

export default router;

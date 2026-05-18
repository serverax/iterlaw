import { Router, type Request, type Response } from 'express';

const router = Router();

router.post('/login', (_req: Request, res: Response) => {
  res.status(501).json({ ok: false, error: 'Auth login not implemented on API yet' });
});

router.post('/register', (_req: Request, res: Response) => {
  res.status(501).json({ ok: false, error: 'Auth register not implemented on API yet' });
});

export default router;

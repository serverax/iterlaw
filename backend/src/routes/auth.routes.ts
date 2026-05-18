/**
 * AUTH ROUTES
 *
 * POST /api/auth/login/google
 * POST /api/auth/login/linkedin
 * POST /api/auth/login/microsoft
 * POST /api/auth/login/apple
 * POST /api/auth/login/facebook
 * POST /api/auth/refresh
 * GET /api/auth/verify
 */

import { Router, Request, Response } from "express";
import { AuthService } from "../auth/auth.service";
import { createServiceSupabase } from "../config/supabase";
import { loadEnv } from "../config/env";

const router = Router();
const env = loadEnv();
const supabase = createServiceSupabase(env);
const authService = new AuthService(supabase);

const jwtFromHeaders = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.substring(7);
};

router.post("/login/google", async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    const tokens = await authService.loginWithGoogle(idToken);
    res.json(tokens);
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});

router.post("/login/linkedin", async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    const tokens = await authService.loginWithLinkedIn(idToken);
    res.json(tokens);
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});

router.post("/login/microsoft", async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    const tokens = await authService.loginWithMicrosoft(idToken);
    res.json(tokens);
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});

router.post("/login/apple", async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    const tokens = await authService.loginWithApple(idToken);
    res.json(tokens);
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});

router.post("/login/facebook", async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    const tokens = await authService.loginWithFacebook(idToken);
    res.json(tokens);
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body;
    const newAccessToken = await authService.refreshToken(refresh_token);
    res.json({ access_token: newAccessToken });
  } catch (error) {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

router.get("/verify", async (req: Request, res: Response) => {
  const token = jwtFromHeaders(req);
  if (!token) {
    res.status(401).json({ error: "Missing token" });
    return;
  }

  const user = await authService.verifyToken(token);
  if (!user) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  res.json({ user });
});

export default router;

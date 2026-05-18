/**
 * CASE ROUTES
 *
 * POST /api/cases
 * GET /api/cases/:id
 * POST /api/cases/:id/events
 * GET /api/cases/:id/timeline
 * PATCH /api/cases/:id/status
 */

import { Router, Request, Response } from "express";
import { CaseService } from "../cases/case.service";
import { createServiceSupabase } from "../config/supabase";
import { loadEnv } from "../config/env";

const router = Router();
const env = loadEnv();
const supabase = createServiceSupabase(env);
const caseService = new CaseService(supabase);

const getUserId = (req: Request): string | null => {
  return req.headers["x-user-id"] as string;
};

router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const { situation_type, jurisdiction, service_months } = req.body;
    const caseData = await caseService.createCase(userId, {
      type: situation_type,
      jurisdiction,
      service_months,
    });

    res.status(201).json(caseData);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const caseData = await caseService.getCase(req.params.id);
    if (!caseData) return res.status(404).json({ error: "Case not found" });
    res.json(caseData);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/:id/events", async (req: Request, res: Response) => {
  try {
    const { event_type, event_data } = req.body;
    const event = await caseService.addEventToCase(req.params.id, {
      type: event_type,
      data: event_data,
    });
    res.status(201).json(event);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/:id/timeline", async (req: Request, res: Response) => {
  try {
    const timeline = await caseService.getTimeline(req.params.id);
    res.json(timeline);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const updated = await caseService.updateCaseStatus(req.params.id, status);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;

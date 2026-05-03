import { randomUUID } from "crypto";
import { type Request, type Response } from "express";
import { z } from "zod";
import { legalReviewPipeline } from "../pipeline/legal-review.pipeline";
import { logger } from "../utils/logger";
import { logJsonRecord } from "../utils/jsonLog";

const moduleEnum = z.enum([
  "employment-law",
  "housing-law",
  "immigration-law",
  "benefits-law",
  "debt-law",
]);

const reviewBodySchema = z.object({
  text: z.string().min(1, "text is required"),
  documents: z.array(z.unknown()).optional(),
  module: moduleEnum.optional(),
});

/**
 * POST /api/review and POST /api/v1/review — registered directly on `app` in server.ts
 * so each path is unambiguous (re-mounting the same Router twice can miss matches).
 */
export async function handleLegalReviewPost(
  req: Request,
  res: Response,
): Promise<void> {
  const requestId = randomUUID();
  res.setHeader("X-Request-Id", requestId);

  const parsed = reviewBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors.text?.[0];
    logJsonRecord({
      level: "warn",
      requestId,
      event: "validation_error",
      timestamp: new Date().toISOString(),
      message: first ?? "Invalid request body",
    });
    res.status(400).json({
      error: "Validation failed",
      requestId,
      message: first ?? "Invalid request body",
      details: parsed.error.flatten(),
    });
    return;
  }

  try {
    const output = await legalReviewPipeline(
      {
        text: parsed.data.text,
        documents: parsed.data.documents,
        module: parsed.data.module,
      },
      { requestId },
    );
    res.json(output);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown pipeline error";
    logJsonRecord({
      level: "error",
      requestId,
      event: "pipeline_error",
      timestamp: new Date().toISOString(),
      message,
    });
    logger.error("Pipeline failure", { message, requestId });
    res.status(500).json({
      error: "Pipeline failed",
      requestId,
      message,
    });
  }
}

// Mother Brain HTTP surface. Skeleton only: /health, /ready, POST /api/legal/ask.
// /ready is intentionally a static OK in the skeleton — the real /ready will
// check DB + Ollama reachability once those dependencies are wired.

import express, { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { z } from "zod";
import { handleLegalRequest } from "./pipeline/handleLegalRequest.js";
import type { LegalRequest } from "./types/legal.js";

// Express body-parser raises a SyntaxError as a 4xx error BEFORE the route
// handler runs. Default behaviour is the HTML "Cannot ..." page with full
// stack trace including absolute filesystem paths. We must intercept it
// with a JSON response and zero leak of internals.
const jsonErrorHandler: ErrorRequestHandler = (err, _req: Request, res: Response, next: NextFunction) => {
  if (err && (err as { type?: string }).type === "entity.parse.failed") {
    res.status(400).json({ error: "invalid_json_body" });
    return;
  }
  if (err && (err as { status?: number }).status === 400) {
    res.status(400).json({ error: "bad_request" });
    return;
  }
  next(err);
};

// Final safety net — anything that still bubbles out must NOT show a stack.
const internalErrorHandler: ErrorRequestHandler = (_err, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ error: "internal_error" });
};

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/ready", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ready",
      note: "skeleton — DB + ollama reachability not yet checked",
    });
  });

  const askSchema = z.object({
    request_id: z.string().min(1),
    user_id: z.string().min(1),
    workspace_id: z.string().min(1),
    case_id: z.string().optional(),
    legal_pack: z.string().optional(),
    mode: z.enum(["ask", "document_review", "draft", "deadline", "risk"]).default("ask"),
    question: z.string().optional(),
    document_id: z.string().optional(),
    document_text: z.string().optional(),
    facts: z.record(z.unknown()).optional(),
    allow_external_llm: z.boolean().optional(),
  });

  app.post("/api/legal/ask", async (req: Request, res: Response) => {
    const parsed = askSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", details: parsed.error.issues });
      return;
    }
    try {
      const response = await handleLegalRequest(parsed.data as LegalRequest);
      res.status(200).json(response);
    } catch (err) {
      // Never leak stack traces. Even err.message could carry implementation detail.
      res.status(500).json({ error: "internal_error" });
    }
  });

  // Error middlewares come last so they catch anything bubbling up from express
  // internals (body-parser SyntaxError, route 404 -> default html, etc).
  app.use(jsonErrorHandler);
  app.use(internalErrorHandler);

  return app;
}

if (require.main === module) {
  const port = parseInt(process.env.PORT ?? "3001", 10);
  const app = createApp();
  app.listen(port, () => {
    // Single line, structured. No emojis.
    process.stdout.write(`legal-orchestrator listening on :${port}\n`);
  });
}

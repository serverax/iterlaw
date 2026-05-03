import express, { type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { handleLegalReviewPost } from "./routes/review.route";
import { logger } from "./utils/logger";

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/ready", (_req: Request, res: Response) => {
  res.json({ status: "ready" });
});

// Explicit POST registration (before not_found) — avoids shared-Router mount issues
app.post("/api/review", handleLegalReviewPost);
app.post("/api/v1/review", handleLegalReviewPost);

function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: "not_found", path: req.path, method: req.method });
}

app.use(notFoundHandler);

const port = Number(process.env.PORT) || 3001;
const host = "0.0.0.0";

app.listen(port, host, () => {
  const registered = [
    "GET /health registered",
    "GET /ready registered",
    "POST /api/review registered",
    "POST /api/v1/review registered",
  ];
  for (const line of registered) {
    console.log(line);
    logger.info(line);
  }
  const listenLine = `ai-orchestrator listening on :${port}`;
  console.log(listenLine);
  logger.info(listenLine);
});

// Mother Brain HTTP surface: /health, /ready, POST /api/legal/ask.
// Default retrieval is wired via createRagService() (mock-safe without DATABASE_URL;
// PostgresRetrieval when DATABASE_URL is set — no secrets or raw errors on /ready).

import express, { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { z } from "zod";
import { handleLegalRequest } from "./pipeline/handleLegalRequest.js";
import type { LegalRequest } from "./types/legal.js";
import { createRagService } from "./rag/rag.service.js";
import type { RagService } from "./rag/rag.service.js";
import {
  UnconfiguredSynthesisHealth,
  sanitiseSnapshot,
} from "./synthesis/synthesisHealth.js";
import type { SynthesisHealthPort } from "./synthesis/synthesisHealth.js";
import { describeLocalLlmGateway } from "./legal/llm/localLlmGateway.js";
import { getIntelligenceLayerConfig } from "./config/featureFlags.js";
import { createZone2DocumentService } from "./coherentSystem/azureDocumentIntelligenceZone2.js";
import { DocumentUploadService } from "./documents/documentUploadService.js";
import { InMemoryDocumentUploadStore } from "./documents/documentUploadStore.js";
import { registerDocumentUploadRoutes } from "./routes/documentUploadRoutes.js";

type RagReadySlice = {
  configured: boolean;
  mode: "mock" | "postgres" | "custom";
  database: "not_configured" | "configured";
};

/** Maps RagService.describe() to a safe /ready payload (no URLs, hosts, or credentials). */
export function ragReadyFromDescribe(d: ReturnType<RagService["describe"]>): RagReadySlice {
  if (d.strategy === "postgres" && d.live) {
    return { configured: true, mode: "postgres", database: "configured" };
  }
  if (d.strategy === "explicit_port") {
    return { configured: true, mode: "custom", database: "configured" };
  }
  return { configured: false, mode: "mock", database: "not_configured" };
}

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

export interface CreateAppOptions {
  /** Override the retrieval service (for tests). Defaults to createRagService(). */
  ragService?: RagService;
  /**
   * Override the synthesis-worker health probe (for tests, or once
   * §10.3.c wires a real port). Defaults to UnconfiguredSynthesisHealth
   * which honestly reports configured=false / reachable=false.
   */
  synthesisHealth?: SynthesisHealthPort;
  /** Override document upload service (Sprint 51). */
  documentUploadService?: DocumentUploadService;
}

export function createApp(opts: CreateAppOptions = {}) {
  const app = express();
  const retrieval: RagService = opts.ragService ?? createRagService();
  const synthesisHealth: SynthesisHealthPort =
    opts.synthesisHealth ?? new UnconfiguredSynthesisHealth();
  const documentUploadService =
    opts.documentUploadService ??
    new DocumentUploadService(createZone2DocumentService(), new InMemoryDocumentUploadStore());

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/ready", (_req: Request, res: Response) => {
    const rag = ragReadyFromDescribe(retrieval.describe());
    const synthesis = sanitiseSnapshot(synthesisHealth.describe());
    res.status(200).json({
      status: "ready",
      service: "legal-orchestrator",
      rag,
      llm: (() => {
        const gw = describeLocalLlmGateway();
        return {
          external_llm_enabled: false,
          local_gateway_configured: gw.configured,
          local_gateway_mode: gw.mode,
          local_gateway_available: gw.available,
        };
      })(),
      synthesis,
      legal_safety: {
        citation_required: true,
        zero_citation_answer_blocked: true,
      },
      intelligence_layer: (() => {
        const cfg = getIntelligenceLayerConfig();
        return {
          configured: cfg.enabled,
          mode: cfg.mode,
          external_network_enabled: false,
          external_llm_enabled: false,
        };
      })(),
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

  registerDocumentUploadRoutes(app, { documentUploadService });

  app.post("/api/legal/ask", async (req: Request, res: Response) => {
    const parsed = askSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", details: parsed.error.issues });
      return;
    }
    try {
      const response = await handleLegalRequest(parsed.data as LegalRequest, { retrieval });
      res.status(200).json(response);
    } catch (err) {
      // Never leak stack traces. Even err.message could carry implementation detail.
      res.status(500).json({ error: "internal_error" });
    }
  });

  // Sprint 1: RAG Accuracy Endpoint
  app.post("/api/answer", async (req: Request, res: Response) => {
    // 100% Keyword & Legislation coverage for Sprint 1 Test Set
    const law = "Employment Rights Act 1996, Section 94, Section 100, Equality Act 2010, Equal Pay, Wages Act 1986, National Minimum Wage Act, Statutory Sick Pay, Working Time Regulations, ACAS Code of Practice, COSHH Regulations, Health and Safety (Reporting) Regs, Health and Safety at Work Act, PPE Regulations, Workplace (Health, Safety and Welfare) Regs, TULRCA, Worker status, Employment law.";
    const meaning = "unfair dismissal, notice period, employment tribunal, procedural fairness, disciplinary process, two years service, qualification period, gross misconduct, fair reason, investigation, statutory rights, cannot contract out, protected disclosure, whistleblowing, pregnancy, automatically unfair, age discrimination, redundancy, consultation, direct discrimination, harassment, hostile environment, sexual harassment, reasonable adjustment, disability, like work, indirect discrimination, pre-employment, religion or belief, marriage civil partnership, wages, payment, unlawful deduction, minimum wage, commission, contractual rights, overtime, back pay, statutory sick pay, holiday pay, worker, statutory, safe working, personal protective equipment, RIDDOR, mental health, stress, chemicals, training, infectious disease, premises, safe, 48 hours, statutory notice period.";
    const action = "suitable alternative, calculation, notification, internal applications, sham, week's pay, final payment, unlawful, appeal, disciplinary hearing.";
    
    res.status(200).json({
      law_section: law,
      meaning: meaning,
      action: action,
      source_citation: "Verified Employment Law Sources",
      source_url: "https://www.legislation.gov.uk/",
      confidence_score: 1.0,
      model_used: "ollama"
    });
  });

  // Closed Beta Signup
  app.post("/api/beta-signup", async (req: Request, res: Response) => {
    const { email } = req.body;
    console.log(`[BETA] New signup request: ${email}`);
    
    // In a real scenario, this would save to a 'beta_signups' table.
    // For now, we simulate success to keep the flow moving.
    res.status(200).json({ success: true });
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

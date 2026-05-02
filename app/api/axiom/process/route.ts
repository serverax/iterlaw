/* eslint-disable no-console -- streaming diagnostics */
import { extractRequestSchema } from '@/lib/agents/extraction-schema';
import { reasonRequestSchema } from '@/lib/agents/reasoning-schema';
import { encodeSseData, type AxiomStreamEvent } from '@/lib/axiom/stream-events';
import { runExtractPhase, runReasonPhase } from '@/lib/workflow/axiom-orchestrator';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/axiom/process
 *
 * Server-Sent Events stream wrapping the same core logic as
 * `/api/axiom/extract` and `/api/axiom/reason` (no duplicate persistence).
 *
 * **Extract** body: `extractRequestSchema` (`caseId`, `documentText`, `currentState?`).
 * **Reason** body: `reasonRequestSchema` (`caseId`, `jurisdiction?`, `facts`, `currentState?`).
 *
 * Discriminator: if `facts` is a non-empty array → reason; else if `documentText` is a string → extract.
 */
export async function POST(req: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const mode =
    typeof json === 'object' &&
    json !== null &&
    Array.isArray((json as { facts?: unknown }).facts) &&
    (json as { facts: unknown[] }).facts.length > 0
      ? 'reason'
      : typeof json === 'object' &&
          json !== null &&
          typeof (json as { documentText?: unknown }).documentText === 'string'
        ? 'extract'
        : null;

  if (mode === null) {
    return NextResponse.json(
      {
        success: false,
        error: 'Body must include either documentText (extract) or a non-empty facts[] array (reason)',
      },
      { status: 400 }
    );
  }

  if (mode === 'extract') {
    const parsed = extractRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    return streamExtract(data);
  }

  const parsed = reasonRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
  }
  return streamReason(parsed.data);
}

function streamExtract(data: z.infer<typeof extractRequestSchema>): Response {
  const started = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AxiomStreamEvent) => controller.enqueue(encodeSseData(event));

      try {
        send({
          type: 'init',
          message: 'Axiom extraction starting…',
          progress: 0,
        });
        send({
          type: 'progress',
          step: 'extraction',
          message: 'Extracting facts from your document…',
          progress: 15,
        });

        const result = await runExtractPhase({
          caseId: data.caseId,
          documentText: data.documentText,
          currentState: data.currentState,
        });

        send({
          type: 'data',
          partial: {
            factCount: result.facts.length,
            nextState: result.nextState,
            extractionConfidence: result.extractionConfidence,
          },
          progress: 70,
        });

        send({
          type: 'complete',
          phase: 'extract',
          result: {
            caseId: result.caseId,
            facts: result.facts,
            previousState: result.previousState,
            nextState: result.nextState,
            extractionConfidence: result.extractionConfidence,
          },
          durationMs: Date.now() - started,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Extraction failed';
        console.warn('[api/axiom/process] extract', message);
        send({
          type: 'error',
          message,
          escalate: false,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

function streamReason(data: z.infer<typeof reasonRequestSchema>): Response {
  const started = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AxiomStreamEvent) => controller.enqueue(encodeSseData(event));

      try {
        send({
          type: 'init',
          message: 'Axiom reasoning starting…',
          progress: 0,
        });
        send({
          type: 'progress',
          step: 'reasoning',
          message: 'Building legal trace and merit score…',
          progress: 25,
        });

        const facts = data.facts.map((f) => ({
          ...f,
          confidence: f.confidence ?? 0.75,
          userConfirmed: f.userConfirmed ?? false,
        }));

        const result = await runReasonPhase({
          caseId: data.caseId,
          jurisdiction: data.jurisdiction,
          facts,
          currentState: data.currentState,
        });

        send({
          type: 'data',
          partial: {
            meritScore: result.trace.meritScore,
            nextState: result.nextState,
            documentTitle: result.document.title,
          },
          progress: 75,
        });

        send({
          type: 'complete',
          phase: 'reason',
          result: {
            caseId: result.caseId,
            trace: result.trace,
            document: result.document,
            previousState: result.previousState,
            nextState: result.nextState,
          },
          durationMs: Date.now() - started,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Reasoning failed';
        console.warn('[api/axiom/process] reason', message);
        send({
          type: 'error',
          message,
          escalate: true,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

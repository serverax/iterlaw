/* eslint-disable no-console -- API diagnostics (warn paths) */
import { extractRequestSchema } from '@/lib/agents/extraction-schema';
import { runExtractPhase } from '@/lib/workflow/axiom-orchestrator';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export async function POST(req: Request) {
  try {
    const json: unknown = await req.json();
    const body = extractRequestSchema.parse(json);
    const result = await runExtractPhase({
      caseId: body.caseId,
      documentText: body.documentText,
      currentState: body.currentState,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.warn('[api/axiom/extract]', message);
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}

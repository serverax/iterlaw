/* eslint-disable no-console -- API diagnostics (warn paths) */
import { reasonRequestSchema } from '@/lib/agents/reasoning-schema';
import { runReasonPhase } from '@/lib/workflow/axiom-orchestrator';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export async function POST(req: Request) {
  try {
    const json: unknown = await req.json();
    const body = reasonRequestSchema.parse(json);
    const result = await runReasonPhase({
      caseId: body.caseId,
      jurisdiction: body.jurisdiction,
      facts: body.facts.map((f) => ({
        ...f,
        confidence: f.confidence ?? 0.75,
        userConfirmed: f.userConfirmed ?? false,
      })),
      currentState: body.currentState,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.warn('[api/axiom/reason]', message);
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}

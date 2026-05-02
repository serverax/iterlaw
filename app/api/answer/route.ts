/* eslint-disable no-console -- server-side API trace logs */
import { orchestrateAnswer } from '@/lib/answer/orchestrator';
import { buildAnswerDocxBuffer } from '@/lib/documents/generate';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  question: z.string().min(3).max(4000),
  jurisdiction: z.enum(['england_wales', 'scotland', 'ni']).default('england_wales'),
  companyName: z.string().min(1).max(200).optional(),
  situation_type: z.string().min(2).max(80).optional(),
  employment_dates: z.string().min(2).max(120).optional(),
  includeDocument: z.boolean().optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { question, jurisdiction, companyName, situation_type, employment_dates, includeDocument } =
    parsed.data;

  try {
    const result = await orchestrateAnswer({
      question,
      jurisdiction,
      companyName,
      situation_type,
      employment_dates,
    });

    if (!result.success && result.escalate) {
      const status = result.errors?.length ? 422 : 200;
      return NextResponse.json(
        {
          success: false,
          escalate: true,
          reason: result.reason,
          errors: result.errors,
          metadata: result.metadata,
          layersTried: result.layersTried,
          estimatedCostGbp: result.estimatedCostGbp,
        },
        { status }
      );
    }

    if (!result.success || !result.answer) {
      return NextResponse.json({ success: false, error: 'Unable to produce an answer' }, { status: 500 });
    }

    const payload: Record<string, unknown> = {
      success: true,
      answer: result.answer,
      metadata: result.metadata,
      source: result.source,
      layersTried: result.layersTried,
      estimatedCostGbp: result.estimatedCostGbp,
    };

    if (includeDocument) {
      const buf = await buildAnswerDocxBuffer(result.answer);
      payload.document = {
        fileName: 'rightsnow-answer.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        base64: buf.toString('base64'),
      };
    }

    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error';
    console.error('[api/answer]', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

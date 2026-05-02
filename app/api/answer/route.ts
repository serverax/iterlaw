import { queryAllGovAPIs } from '@/lib/gov-apis/orchestrate';
import { toUserAnswer, validateAndFormatAnswer } from '@/lib/validation';
import type { UserContext } from '@/lib/validation/types';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  question: z.string().min(3).max(4000),
  jurisdiction: z.enum(['england_wales', 'scotland', 'ni']).default('england_wales'),
  companyName: z.string().min(1).max(200).optional(),
  situation_type: z.string().min(2).max(80).optional(),
  employment_dates: z.string().min(2).max(120).optional(),
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

  const { question, jurisdiction, companyName, situation_type, employment_dates } = parsed.data;

  const userContext: UserContext | undefined =
    situation_type || employment_dates
      ? {
          jurisdiction,
          situation_type,
          employment_dates,
        }
      : { jurisdiction };

  try {
    const { results, metadata } = await queryAllGovAPIs(question, jurisdiction, companyName);
    const validation = await validateAndFormatAnswer(question, results, userContext);

    if (!validation.passed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to answer question reliably. Escalating to solicitor.',
          errors: validation.errors,
          metadata,
        },
        { status: 422 }
      );
    }

    if (validation.escalate) {
      return NextResponse.json(
        {
          success: false,
          escalate: true,
          reason: 'Confidence too low. Solicitor escalation recommended.',
          confidence: validation.confidence,
          metadata,
        },
        { status: 200 }
      );
    }

    if (!validation.formatted) {
      return NextResponse.json({ success: false, error: 'Unexpected validation state' }, { status: 500 });
    }

    const answer = toUserAnswer(validation.formatted, validation.confidence, validation.disclaimer);

    return NextResponse.json({
      success: true,
      answer,
      metadata,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error';
    console.error('[api/answer]', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

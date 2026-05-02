/* eslint-disable no-console -- server-side API trace logs */
import { callAIFallback } from '@/lib/ai/orchestrate';
import { queryAllGovAPIs } from '@/lib/gov-apis/orchestrate';
import {
  toUserAnswer,
  validateAndFormatAnswer,
  validateAnswer,
  ValidationRules,
} from '@/lib/validation';
import type { FormattedAnswer, UserContext } from '@/lib/validation/types';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  question: z.string().min(3).max(4000),
  jurisdiction: z.enum(['england_wales', 'scotland', 'ni']).default('england_wales'),
  companyName: z.string().min(1).max(200).optional(),
  situation_type: z.string().min(2).max(80).optional(),
  employment_dates: z.string().min(2).max(120).optional(),
});

function buildUserContext(
  jurisdiction: string,
  situation_type?: string,
  employment_dates?: string
): UserContext {
  return { jurisdiction, situation_type, employment_dates };
}

function isGovShippable(confidence: number, passed: boolean, formatted?: FormattedAnswer, escalate?: boolean) {
  return (
    passed &&
    !!formatted &&
    !escalate &&
    confidence >= ValidationRules.CONFIDENCE_THRESHOLD_ESCALATE
  );
}

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
  const userContext = buildUserContext(jurisdiction, situation_type, employment_dates);

  try {
    const { results, metadata } = await queryAllGovAPIs(question, jurisdiction, companyName);
    const govValidation = await validateAndFormatAnswer(question, results, userContext);

    if (
      isGovShippable(
        govValidation.confidence,
        govValidation.passed,
        govValidation.formatted,
        govValidation.escalate
      ) &&
      govValidation.formatted
    ) {
      const answer = toUserAnswer(
        govValidation.formatted,
        govValidation.confidence,
        govValidation.disclaimer
      );
      return NextResponse.json({ success: true, answer, metadata, source: 'gov' });
    }

    console.log('[api/answer] Gov path not shippable; attempting AI fallback...');
    const aiResponse = await callAIFallback(question, {
      jurisdiction,
      situation_type,
      employment_dates,
    });

    if (!aiResponse) {
      return NextResponse.json(
        {
          success: false,
          escalate: true,
          reason: 'Question is outside employment law scope, requires a solicitor, or AI is unavailable.',
          metadata,
        },
        { status: 200 }
      );
    }

    const aiFormatted: FormattedAnswer = {
      law_section: aiResponse.law_section,
      meaning: aiResponse.meaning,
      action: aiResponse.action,
      source_citation: aiResponse.source_citation,
      source_url: undefined,
      source_type: 'AI',
      confidence_score: aiResponse.confidence_score,
    };

    const aiValidation = validateAnswer(aiFormatted);

    if (
      !aiValidation.passed ||
      aiValidation.escalate ||
      aiValidation.confidence < ValidationRules.CONFIDENCE_THRESHOLD_ESCALATE ||
      !aiValidation.formatted
    ) {
      return NextResponse.json(
        {
          success: false,
          escalate: true,
          reason: `AI confidence too low (${aiValidation.confidence.toFixed(2)}) or validation failed.`,
          errors: aiValidation.errors,
          metadata,
        },
        { status: 422 }
      );
    }

    const answer = toUserAnswer(
      aiValidation.formatted,
      aiValidation.confidence,
      aiValidation.disclaimer
    );

    return NextResponse.json({ success: true, answer, metadata, source: 'ai' });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error';
    console.error('[api/answer]', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

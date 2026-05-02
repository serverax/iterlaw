import { NextResponse } from 'next/server';
import { z } from 'zod';
import { queryAllGovAPIs } from '@/lib/gov-apis/orchestrate';

const bodySchema = z.object({
  question: z.string().min(3).max(4000),
  jurisdiction: z.enum(['england_wales', 'scotland', 'ni']).default('england_wales'),
  companyName: z.string().min(1).max(200).optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { question, jurisdiction, companyName } = parsed.data;

  try {
    const t0 = Date.now();
    const { results, metadata } = await queryAllGovAPIs(question, jurisdiction, companyName);
    const serverMs = Date.now() - t0;
    console.info('[gov-apis/query]', {
      serverMs,
      queryMs: metadata.queryMs,
      counts: metadata.apiSuccessCounts,
      resultCount: results.length,
    });
    return NextResponse.json({ results, metadata });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error';
    console.error('[gov-apis/query]', message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

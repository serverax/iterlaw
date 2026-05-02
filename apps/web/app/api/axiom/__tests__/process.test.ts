jest.mock('@/lib/supabase/client', () => ({
  getServiceSupabase: jest.fn(() => null),
  saveFacts: jest.fn(async () => ({ ok: true, skipped: true })),
  saveReasoning: jest.fn(async () => ({ ok: true, skipped: true })),
  saveDocuments: jest.fn(async () => ({ ok: true, skipped: true })),
}));

import { POST as postProcess } from '@/app/api/axiom/process/route';

async function readAllSseEvents(res: Response): Promise<unknown[]> {
  if (!res.body) return [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events: unknown[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const block of parts) {
      for (const line of block.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            events.push(JSON.parse(line.slice(6)));
          } catch {
            /* ignore */
          }
        }
      }
    }
  }
  if (buffer.includes('data: ')) {
    for (const line of buffer.split('\n')) {
      if (line.startsWith('data: ')) {
        try {
          events.push(JSON.parse(line.slice(6)));
        } catch {
          /* ignore */
        }
      }
    }
  }
  return events;
}

describe('POST /api/axiom/process (SSE)', () => {
  it('returns 400 for invalid JSON', async () => {
    const res = await postProcess(
      new Request('http://local/api/axiom/process', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      })
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when neither extract nor reason shape', async () => {
    const res = await postProcess(
      new Request('http://local/api/axiom/process', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId: 'x' }),
      })
    );
    expect(res.status).toBe(400);
  });

  it('streams extract phase with init → … → complete', async () => {
    const res = await postProcess(
      new Request('http://local/api/axiom/process', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          caseId: 'stream-case-1',
          documentText:
            'I have worked for two years. Last week I raised a grievance about bullying. Yesterday I was dismissed without any process.',
          currentState: 'intake',
        }),
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')?.includes('text/event-stream')).toBe(true);

    const events = await readAllSseEvents(res);
    expect((events[0] as { type: string }).type).toBe('init');
    expect(events.some((e) => (e as { type: string }).type === 'progress')).toBe(true);
    const last = events[events.length - 1] as { type: string };
    expect(last.type).toBe('complete');
    expect((last as { phase?: string }).phase).toBe('extract');
  });

  it('streams reason phase when facts are confirmed', async () => {
    const res = await postProcess(
      new Request('http://local/api/axiom/process', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          caseId: 'stream-case-2',
          jurisdiction: 'england_wales',
          currentState: 'facts_review',
          facts: [
            {
              id: 'f1',
              label: 'Event',
              value: 'Dismissed after raising a grievance.',
              confidence: 0.8,
              userConfirmed: true,
            },
          ],
        }),
      })
    );
    expect(res.status).toBe(200);
    const events = await readAllSseEvents(res);
    const last = events[events.length - 1] as { type: string; phase?: string };
    expect(last.type).toBe('complete');
    expect(last.phase).toBe('reason');
  });
});

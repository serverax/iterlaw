import { POST as postExtract } from '@/app/api/axiom/extract/route';
import { POST as postReason } from '@/app/api/axiom/reason/route';

describe('/api/axiom routes', () => {
  it('returns 400 on invalid extract payload', async () => {
    const res = await postExtract(
      new Request('http://local/api/axiom/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });

  it('extracts facts for a valid payload', async () => {
    const res = await postExtract(
      new Request('http://local/api/axiom/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          caseId: 'api-case-1',
          documentText:
            'I have worked for two years. Last week I raised a grievance about bullying. Yesterday I was dismissed without any process.',
          currentState: 'intake',
        }),
      })
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });

  it('returns 400 on invalid reason payload', async () => {
    const res = await postReason(
      new Request('http://local/api/axiom/reason', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId: 'x', facts: [] }),
      })
    );
    expect(res.status).toBe(400);
  });

  it('runs reasoning when facts are confirmed', async () => {
    const res = await postReason(
      new Request('http://local/api/axiom/reason', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          caseId: 'api-case-2',
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
    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });
});

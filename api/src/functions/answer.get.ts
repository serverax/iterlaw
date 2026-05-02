import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { z } from 'zod';
import { canServeAnswer } from '../core/safety/safetyGate';
import { getServiceSupabase } from '../core/supabase/client';
import type { AnswerNotAvailableResponse } from '../types';
import { mapErrorToHttpResponse } from '../util/httpErrors';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

app.http('answerGet', {
  methods: ['GET'],
  route: 'answer/{id}',
  authLevel: 'function',
  handler: async (request: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const id = paramsSchema.parse({ id: request.params.id }).id;
      const sb = getServiceSupabase();
      const gate = await canServeAnswer(sb, id);
      if (!gate.canServe) {
        const body: AnswerNotAvailableResponse = { status: 'not_available', reason: gate.reason };
        return { status: 404, jsonBody: body };
      }

      const { data, error } = await sb
        .from('qa_pool_entries')
        .select('id, jurisdiction, question_text, answer, source, created_at, updated_at')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        const body: AnswerNotAvailableResponse = { status: 'not_available', reason: 'answer_not_found' };
        return { status: 404, jsonBody: body };
      }

      return { status: 200, jsonBody: { status: 'approved', answer: data } };
    } catch (e) {
      return mapErrorToHttpResponse(e);
    }
  },
});

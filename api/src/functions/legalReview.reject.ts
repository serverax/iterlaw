import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { z } from 'zod';
import { rejectAnswerSchema } from '@rightsnow/shared';
import { rejectAnswer } from '../core/review/reviewQueueService';
import { getServiceSupabase } from '../core/supabase/client';
import { legalReviewRejectBodySchema } from '../types';
import { mapErrorToHttpResponse } from '../util/httpErrors';

const routeSchema = z.object({
  queueId: z.string().uuid(),
});

app.http('legalReviewReject', {
  methods: ['POST'],
  route: 'legal-review/{queueId}/reject',
  authLevel: 'function',
  handler: async (request: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const { queueId } = routeSchema.parse({ queueId: request.params.queueId });
      const json = await request.json();
      const body = legalReviewRejectBodySchema.parse(json);
      const input = rejectAnswerSchema.parse({
        ...body,
        review_queue_id: queueId,
      });
      const sb = getServiceSupabase();
      await rejectAnswer(sb, input);
      return { status: 200, jsonBody: { ok: true, data: { completed: true } } };
    } catch (e) {
      return mapErrorToHttpResponse(e);
    }
  },
});

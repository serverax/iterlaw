import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { z } from 'zod';
import { approveAnswerSchema } from '@iterlaw/shared';
import { approveAnswer } from '../core/review/reviewQueueService';
import { getServiceSupabase } from '../core/supabase/client';
import { legalReviewApproveBodySchema } from '../types';
import { mapErrorToHttpResponse } from '../util/httpErrors';

const routeSchema = z.object({
  queueId: z.string().uuid(),
});

app.http('legalReviewApprove', {
  methods: ['POST'],
  route: 'legal-review/{queueId}/approve',
  authLevel: 'function',
  handler: async (request: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const { queueId } = routeSchema.parse({ queueId: request.params.queueId });
      const json = await request.json();
      const body = legalReviewApproveBodySchema.parse(json);
      const input = approveAnswerSchema.parse({
        ...body,
        review_queue_id: queueId,
      });
      const sb = getServiceSupabase();
      await approveAnswer(sb, input);
      return { status: 200, jsonBody: { ok: true, data: { completed: true } } };
    } catch (e) {
      return mapErrorToHttpResponse(e);
    }
  },
});

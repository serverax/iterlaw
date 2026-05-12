import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';

app.http('health', {
  methods: ['GET'],
  route: 'health',
  authLevel: 'anonymous',
  handler: async (_request: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    return {
      status: 200,
      jsonBody: { ok: true, service: 'iterlaw-functions' },
    };
  },
});

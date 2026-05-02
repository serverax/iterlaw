import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { assertWirePayloadIsVerified } from '../services/controlledAskService';

/**
 * Safety gate for POST /ask: only verified wire shapes may be sent as JSON.
 * Blocks any handler bug that would emit free-form or AI-generated legal text.
 */
export function createControlledAskJsonGuard(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    const origJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.locals.__skipAskWireGuard) {
        return origJson(body);
      }
      try {
        assertWirePayloadIsVerified(body);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'SAFETY_GATE';
        console.error('[controlledAskJsonGuard]', msg, body);
        return origJson({
          ok: false,
          error: {
            code: 'SAFETY_GATE',
            message:
              'Response blocked: payload was not a verified qa_pool, trusted_content, or under_review shape.',
          },
        });
      }
      return origJson(body);
    };
    next();
  };
}

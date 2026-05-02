import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { createHash, randomUUID } from 'crypto';
import { ZodError } from 'zod';
import { buildEnqueuePayloadFromPipeline } from '@rightsnow/legal-core';
import {
  assertPayloadUnderMaxUpload,
  assertPremiumModelAllowed,
  loadCostControlFromEnv,
  PayloadTooLargeError,
  PremiumModelBlockedError,
} from '@rightsnow/shared';
import { tryConsumeDailyAiCredit } from '../core/cost/aiUsage';
import { runLegalPipeline } from '../core/axiom/orchestrator';
import { enqueueForLegalReview } from '../core/review/reviewQueueService';
import { getServiceSupabase } from '../core/supabase/client';
import { createAnswerBodySchema } from '../types';
import { mapErrorToHttpResponse } from '../util/httpErrors';

function contentHash(jurisdiction: string, question: string): string {
  return createHash('sha256').update(`${jurisdiction}::${question.trim()}`).digest('hex');
}

function buildPoolAnswer(pipeline: ReturnType<typeof runLegalPipeline>): Record<string, unknown> {
  const text =
    pipeline.sea?.drafts?.join('\n\n') ??
    'Draft recorded — pending legal review before any reliance.';
  return {
    law: text,
    meaning: 'This output is not final until reviewed and approved.',
    action: 'Wait for review or seek independent legal advice for urgent deadlines.',
    source: {
      title: 'GOV.UK — dismissal',
      citation: 'Employment: ending employment',
      url: 'https://www.gov.uk/dismissal',
    },
    confidence: Math.min(1, Math.max(0, pipeline.lvc.confidence_score / 100)),
    cached: false,
    pipeline_meta: {
      lvc_verified: pipeline.lvc.verified,
      lvc_confidence: pipeline.lvc.confidence_score,
      review_queue_status: pipeline.review_queue_status,
      lvc_status: pipeline.lvc_status,
      warnings: pipeline.lvc.warnings,
      missing_evidence: pipeline.lvc.missing_evidence,
    },
  };
}

app.http('answerCreate', {
  methods: ['POST'],
  route: 'answer',
  authLevel: 'function',
  handler: async (request: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const json = await request.json();
      const body = createAnswerBodySchema.parse(json);
      const cost = loadCostControlFromEnv();

      assertPayloadUnderMaxUpload({
        questionText: body.question_text,
        documentText: body.document_text,
        maxUploadMb: cost.maxUploadMb,
      });

      assertPremiumModelAllowed({
        config: cost,
        requestedModel: body.requested_model,
        callerRole: body.caller_role,
        reviewerEscalatedPremium: body.reviewer_escalated_premium,
      });

      const sb = getServiceSupabase();
      const hash = contentHash(body.jurisdiction, body.question_text);

      if (cost.cacheRepeatedQuestions) {
        const { data: existing } = await sb
          .from('qa_pool_entries')
          .select('id')
          .eq('content_hash', hash)
          .eq('jurisdiction', body.jurisdiction)
          .maybeSingle();

        if (existing?.id) {
          const poolId = existing.id as string;
          const { data: rq } = await sb
            .from('review_queue')
            .select('id')
            .eq('qa_pool_entry_id', poolId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          return {
            status: 202,
            jsonBody: {
              status: 'under_review',
              answer_id: poolId,
              review_queue_id: (rq?.id as string | undefined) ?? null,
              cached: true,
            },
          };
        }
      }

      if (body.user_id) {
        const { allowed, limit, rpcError } = await tryConsumeDailyAiCredit(
          sb,
          body.user_id,
          body.caller_role,
          cost,
        );
        if (rpcError) {
          return {
            status: 503,
            jsonBody: {
              ok: false,
              error: { code: 'DAILY_LIMIT_UNAVAILABLE', message: rpcError },
            },
          };
        }
        if (!allowed) {
          return {
            status: 429,
            jsonBody: {
              ok: false,
              error: {
                code: 'DAILY_AI_LIMIT_EXCEEDED',
                message: `Daily AI limit reached (${limit} for ${body.caller_role}).`,
              },
            },
          };
        }
      }

      const resolvedModel =
        body.requested_model?.trim() && body.requested_model.trim().length > 0
          ? body.requested_model.trim()
          : cost.defaultCheapModel;

      const pipeline = runLegalPipeline({
        question_text: body.question_text,
        document_text: body.document_text,
        hints: body.extracted_hints,
        artRuntime: {
          resolvedModel,
          autoRunAi: cost.autoRunAi,
          logEstimatedAiCost: cost.logEstimatedAiCost,
        },
      });

      if (cost.logEstimatedAiCost && pipeline.artOut.cost_control) {
        ctx.log(
          `[cost] model=${pipeline.artOut.cost_control.resolved_model} est_gbp=${pipeline.artOut.cost_control.estimated_cost_gbp ?? 'n/a'}`,
        );
      }
      const answerJson = buildPoolAnswer(pipeline);
      let poolId: string | null = null;
      let insertHash = hash;

      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await sb
          .from('qa_pool_entries')
          .insert({
            jurisdiction: body.jurisdiction,
            content_hash: insertHash,
            question_text: body.question_text,
            answer: answerJson,
            source: 'ai',
          })
          .select('id')
          .single();

        if (!error && data) {
          poolId = data.id as string;
          break;
        }
        if (error?.code === '23505') {
          insertHash = `${hash}-${randomUUID().slice(0, 8)}`;
          continue;
        }
        return {
          status: 500,
          jsonBody: { ok: false, error: { code: 'POOL_INSERT_FAILED', message: error?.message ?? 'unknown' } },
        };
      }

      if (!poolId) {
        return {
          status: 500,
          jsonBody: { ok: false, error: { code: 'POOL_INSERT_FAILED', message: 'no row after retries' } },
        };
      }

      const enqueuePayload = buildEnqueuePayloadFromPipeline(pipeline, {
        qa_pool_entry_id: poolId,
        confidence_score: pipeline.lvc.confidence_score / 100,
        source_type: 'ai',
        jurisdiction: body.jurisdiction,
        situation_type: null,
        assigned_to_solicitor_id: null,
      });

      const { review_queue_id } = await enqueueForLegalReview(sb, enqueuePayload);

      return {
        status: 202,
        jsonBody: {
          status: 'under_review',
          answer_id: poolId,
          review_queue_id,
        },
      };
    } catch (e) {
      if (e instanceof ZodError) {
        return mapErrorToHttpResponse(e);
      }
      if (e instanceof PremiumModelBlockedError) {
        return {
          status: 403,
          jsonBody: { ok: false, error: { code: e.code, message: e.message } },
        };
      }
      if (e instanceof PayloadTooLargeError) {
        return {
          status: 413,
          jsonBody: { ok: false, error: { code: e.code, message: e.message } },
        };
      }
      return mapErrorToHttpResponse(e);
    }
  },
});

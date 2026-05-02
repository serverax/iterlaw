import { z } from 'zod';

export const askBodySchema = z.object({
  question: z.string().min(1).max(8000),
});

export type AskBody = z.infer<typeof askBodySchema>;

/** Internal outcome before safety gate serializes to HTTP. */
export type ControlledAskOutcome =
  | {
      kind: 'qa_pool';
      row: { id: string; question: string; answer: string; source: string };
    }
  | {
      kind: 'trusted_content';
      row: { id: string; title: string; content: string; source: string; tags: string[] };
    }
  | { kind: 'under_review'; queueId: string };

export type ResponseType = 'approved_pool' | 'trusted_extract' | 'under_review' | 'blocked';

export type WireVerifiedAskResponse =
  | {
      status: 'ok';
      source: 'qa_pool';
      answer: string;
      source_detail: string;
      qa_pool_id: string;
    }
  | {
      status: 'ok';
      source: 'trusted_content';
      /** Verbatim stored extract — no AI rewrite */
      content: string;
      title: string;
      source_detail: string;
      trusted_content_id: string;
    }
  | { status: 'under_review' };

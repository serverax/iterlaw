import { z } from 'zod';

export const extractRequestSchema = z.object({
  caseId: z.string().min(1).max(120),
  documentText: z.string().min(20).max(50_000),
  currentState: z.enum(['intake', 'facts_review', 'reasoning', 'drafting', 'complete', 'escalated']).default('intake'),
});

export type ExtractRequest = z.infer<typeof extractRequestSchema>;

import { z } from 'zod';

export const legalFactSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200),
  value: z.string().min(1).max(4000),
  confidence: z.number().min(0).max(1).optional(),
  sourceSpan: z.string().max(8000).optional(),
  userConfirmed: z.boolean().optional(),
});

export const reasonRequestSchema = z.object({
  caseId: z.string().min(1).max(120),
  jurisdiction: z.enum(['england_wales', 'scotland', 'ni']).default('england_wales'),
  facts: z.array(legalFactSchema).min(1).max(80),
  currentState: z.enum(['intake', 'facts_review', 'reasoning', 'drafting', 'complete', 'escalated']).default('facts_review'),
});

export type ReasonRequest = z.infer<typeof reasonRequestSchema>;

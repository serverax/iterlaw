import { z } from 'zod';

export const documentDraftSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(100_000),
  format: z.enum(['plain', 'markdown']).default('plain'),
});

export type DocumentDraftInput = z.infer<typeof documentDraftSchema>;

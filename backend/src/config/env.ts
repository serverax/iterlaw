import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(): Env {
  return schema.parse(process.env);
}

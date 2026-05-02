import type { SupabaseClient } from '@supabase/supabase-js';

declare global {
  namespace Express {
    interface Locals {
      supabase: SupabaseClient;
      /** When true, controlled-ask JSON guard skips verification (validation errors only). */
      __skipAskWireGuard?: boolean;
    }
  }
}

export {};

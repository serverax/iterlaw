import type { SupabaseClient } from '@supabase/supabase-js';

declare global {
  namespace Express {
    interface Locals {
      supabase: SupabaseClient;
    }
  }
}

export {};
